import { genId } from '../../lib/genId'
import { useCallback, useRef } from 'react'
import { useAppStore } from '../../stores/app'
import type { Workflow, WorkflowNode } from '../../../../shared/types'
import { detectDangerousContent, CATEGORY_LABELS } from '../../lib/approvalDetection'
import {
  createAgentOutput,
  buildWorkflowContext,
  resolvePromptWithContext,
  buildSystemPromptForWorkflow,
  type AgentOutput
} from '../../lib/contextManager'
import { isApprovalCondition, evaluateCondition, waitForStoreValue } from '../../lib/workflowEngine'

interface Props {
  workflow: Workflow
}

export function WorkflowExecutor({ workflow }: Props) {
  const workflowExecution = useAppStore((s) => s.workflowExecution)
  const startWorkflowExecution = useAppStore((s) => s.startWorkflowExecution)
  const updateNodeExecution = useAppStore((s) => s.updateNodeExecution)
  const completeWorkflowExecution = useAppStore((s) => s.completeWorkflowExecution)
  const addMessage = useAppStore((s) => s.addMessage)
  const soulPrompt = useAppStore((s) => s.soulPrompt)
  const notify = useAppStore((s) => s.notify)
  const submitApproval = useAppStore((s) => s.submitApproval)
  const submitChatApproval = useAppStore((s) => s.submitChatApproval)
  const isRunning = workflowExecution?.status === 'running' && workflowExecution?.workflowId === workflow.id
  const abortRef = useRef(false)

  const callAgentWithContext = async (
    node: WorkflowNode,
    prompt: string,
    agentOutputs: AgentOutput[]
  ): Promise<string> => {
    const context = buildWorkflowContext(workflow.name, node.data.label, agentOutputs)

    if (!window.mixDesktop) {
      return `[模拟] Agent "${node.data.label}" 回复: 收到指令「${prompt.slice(0, 50)}...」\n上下文: ${agentOutputs.length} 个上游节点`
    }

    const systemPrompt = buildSystemPromptForWorkflow(node.data.systemPrompt, soulPrompt, context)

    return new Promise((resolve) => {
      let buffer = ''
      const msgs: { role: string; content: string }[] = [{ role: 'system', content: systemPrompt }]

      // Include last 2 agent outputs as conversation history for context continuity
      const recentOutputs = agentOutputs.slice(-2)
      for (const out of recentOutputs) {
        msgs.push({ role: 'assistant', content: out.content })
      }

      msgs.push({ role: 'user', content: prompt })

      const unsubChunk = window.mixDesktop.onChatChunk((chunk: string) => { buffer += chunk })
      const unsubDone = window.mixDesktop.onChatDone(() => {
        unsubChunk()
        unsubDone()
        unsubError()
        resolve(buffer)
      })
      const unsubError = window.mixDesktop.onChatError((msg: string) => {
        unsubChunk()
        unsubDone()
        unsubError()
        resolve(`[错误] ${msg}`)
      })

      window.mixDesktop.chatSend({ messages: msgs, model: node.data.model || undefined }).catch(() => {
        resolve('[错误] 请求失败')
      })
    })
  }

  const run = useCallback(async () => {
    abortRef.current = false
    const { nodes, edges } = workflow
    const startNode = nodes.find((n) => n.type === 'start')
    if (!startNode) {
      addMessage({ id: genId('error-'), role: 'error', content: '工作流缺少开始节点', timestamp: Date.now() })
      return
    }

    startWorkflowExecution(workflow.id)
    const agentOutputs: AgentOutput[] = []
    const input = ''

    addMessage({
      id: genId('system-'), role: 'system',
      content: `🔀 工作流「${workflow.name}」开始执行`,
      timestamp: Date.now()
    })

    const getOutgoingEdges = (nodeId: string) => edges.filter((e) => e.source === nodeId)
    const visited = new Set<string>()

    const processNode = async (node: WorkflowNode, currentInput: string): Promise<void> => {
      if (abortRef.current) return
      if (visited.has(node.id)) {
        addMessage({ id: genId('error-'), role: 'error', content: `检测到循环引用: 节点「${node.data.label}」被重复访问，已中止`, timestamp: Date.now() })
        return
      }
      visited.add(node.id)

      if (node.type === 'start') {
        updateNodeExecution(node.id, 'completed')
        const outEdges = getOutgoingEdges(node.id)
        for (const edge of outEdges) {
          const target = nodes.find((n) => n.id === edge.target)
          if (target) await processNode(target, '')
        }
        return
      }

      if (node.type === 'end') {
        updateNodeExecution(node.id, 'completed')
        return
      }

      if (node.type === 'condition') {
        updateNodeExecution(node.id, 'running')

        // Human approval condition
        if (isApprovalCondition(node.data.label, node.data.condition)) {
          addMessage({
            id: genId('system-'), role: 'system',
            content: `🔒 条件「${node.data.label}」需要人工审批`,
            timestamp: Date.now()
          })
          notify('工作流审批', `「${node.data.label}」需要你的确认`)

          submitApproval({
            fromMemberId: `wf-${workflow.id}`,
            fromMemberName: `工作流: ${workflow.name}`,
            fromProjectId: workflow.id,
            fromProjectName: '工作流引擎',
            title: `条件审批: ${node.data.label}`,
            description: `工作流「${workflow.name}」在条件节点「${node.data.label}」暂停，等待你的决策。`,
            context: currentInput ? `上游输出:\n${currentInput.slice(0, 500)}` : undefined
          })

          // Wait for latest pending approval to be resolved
          const pendingId = useAppStore.getState().approvalRequests.find(
            (r) => r.status === 'pending' && r.fromMemberId === `wf-${workflow.id}`
          )?.id
          if (pendingId) {
            const resolved = await waitForStoreValue(
              () => useAppStore.getState().approvalRequests.find((r) => r.id === pendingId),
              (req) => !!req && req.status !== 'pending'
            )
            const approved = resolved?.status === 'approved'
            const resultText = approved ? '已批准' : '已拒绝'
            addMessage({
              id: genId('system-'), role: 'system',
              content: `${approved ? '✅' : '❌'} 审批${resultText}: ${node.data.label}`,
              timestamp: Date.now()
            })
            updateNodeExecution(node.id, 'completed')

            const handle = approved ? 'yes' : 'no'
            const outEdges = getOutgoingEdges(node.id)
            const matchedEdge = outEdges.find((e) => e.sourceHandle === handle) || outEdges[0]
            if (matchedEdge) {
              const target = nodes.find((n) => n.id === matchedEdge.target)
              if (target) await processNode(target, currentInput)
            }
            return
          }
        }

        // Auto-evaluate condition
        const result = evaluateCondition(node.data.condition || '', currentInput)

        addMessage({
          id: genId('system-'), role: 'system',
          content: `? 条件「${node.data.label}」: ${result ? '是' : '否'}`,
          timestamp: Date.now()
        })

        updateNodeExecution(node.id, 'completed')
        const handle = result ? 'yes' : 'no'
        const outEdges = getOutgoingEdges(node.id)
        const matchedEdge = outEdges.find((e) => e.sourceHandle === handle) || outEdges[0]
        if (matchedEdge) {
          const target = nodes.find((n) => n.id === matchedEdge.target)
          if (target) await processNode(target, currentInput)
        }
        return
      }

      if (node.type === 'agent') {
        updateNodeExecution(node.id, 'running')
        const context = buildWorkflowContext(workflow.name, node.data.label, agentOutputs)
        const prompt = node.data.prompt
          ? resolvePromptWithContext(node.data.prompt, agentOutputs, currentInput, context)
          : currentInput || '请执行任务'

        addMessage({
          id: genId('system-'), role: 'system',
          content: `▶ Agent「${node.data.label}」执行中... (上下文: ${agentOutputs.length} 个上游节点, ~${context.totalTokens} tokens)`,
          timestamp: Date.now()
        })

        const startTime = Date.now()
        const output = await callAgentWithContext(node, prompt, agentOutputs)
        const agentOutput = createAgentOutput(node.id, node.data.label, output, startTime)
        agentOutputs.push(agentOutput)
        updateNodeExecution(node.id, 'completed', output)

        // Check for dangerous content in agent output
        const detection = detectDangerousContent(output)
        if (detection.detected) {
          const categoryLabel = CATEGORY_LABELS[detection.category!]
          addMessage({
            id: genId('system-'), role: 'system',
            content: `⚠️ Agent「${node.data.label}」输出包含${categoryLabel}操作「${detection.summary}」，等待审批`,
            timestamp: Date.now()
          })
          notify('工作流需要审批', `Agent「${node.data.label}」尝试${categoryLabel}：${detection.summary}`)

          submitChatApproval({
            messageId: `wf-agent-${node.id}`,
            content: output,
            category: detection.category!,
            summary: `[${node.data.label}] ${detection.summary}`,
            confidence: detection.confidence,
            matchedPattern: detection.matchedPattern
          })

          // Wait for chat approval resolution
          const chatResult = await waitForStoreValue(
            () => useAppStore.getState().chatApproval,
            (ca) => !!ca && ca.status !== 'pending'
          )
          if (chatResult?.status === 'rejected') {
            addMessage({
              id: genId('system-'), role: 'system',
              content: `❌ Agent「${node.data.label}」的操作被拒绝，跳过下游节点`,
              timestamp: Date.now()
            })
            return
          }
        }

        addMessage({
          id: genId('agent-'), role: 'agent',
          content: `**${node.data.label}** (${(agentOutput.durationMs / 1000).toFixed(1)}s, ~${agentOutput.tokenEstimate} tokens): ${output}`,
          timestamp: Date.now()
        })

        const outEdges = getOutgoingEdges(node.id)
        const parallelPromises = outEdges.map(async (edge) => {
          const target = nodes.find((n) => n.id === edge.target)
          if (target) await processNode(target, output)
        })
        await Promise.all(parallelPromises)
      }
    }

    try {
      await processNode(startNode, input)
      completeWorkflowExecution(abortRef.current ? 'failed' : 'completed')

      if (!abortRef.current) {
        notify('工作流完成', `「${workflow.name}」执行成功`)
      }

      addMessage({
        id: genId('system-'), role: 'system',
        content: abortRef.current ? `⚠ 工作流「${workflow.name}」已中止` : `✓ 工作流「${workflow.name}」执行完成`,
        timestamp: Date.now()
      })
    } catch {
      completeWorkflowExecution('failed')
      notify('工作流失败', `「${workflow.name}」执行出错`)
      addMessage({
        id: genId('error-'), role: 'error',
        content: `工作流执行失败`,
        timestamp: Date.now()
      })
    }
  }, [workflow, startWorkflowExecution, updateNodeExecution, completeWorkflowExecution, addMessage, soulPrompt, submitApproval, submitChatApproval, notify])

  const abort = useCallback(() => {
    abortRef.current = true
  }, [])

  return (
    <>
      {isRunning ? (
        <button
          onClick={abort}
          className="rounded bg-danger px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-danger/80"
        >
          停止
        </button>
      ) : (
        <button
          onClick={run}
          className="rounded bg-success px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-success/80"
        >
          ▶ 运行
        </button>
      )}
    </>
  )
}
