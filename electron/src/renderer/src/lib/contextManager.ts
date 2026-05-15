import { genId } from './genId'
import type { ChatMessage } from '../../../shared/types'

export interface AgentOutput {
  nodeId: string
  nodeLabel: string
  content: string
  timestamp: number
  durationMs: number
  tokenEstimate: number
  metadata: Record<string, string>
}

export interface WorkflowContext {
  workflowName: string
  currentNode: string
  outputs: AgentOutput[]
  summary: string
  totalTokens: number
}

const CHARS_PER_TOKEN = 3

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN)
}

export function createAgentOutput(
  nodeId: string,
  nodeLabel: string,
  content: string,
  startTime: number,
  metadata: Record<string, string> = {}
): AgentOutput {
  return {
    nodeId,
    nodeLabel,
    content,
    timestamp: Date.now(),
    durationMs: Date.now() - startTime,
    tokenEstimate: estimateTokens(content),
    metadata
  }
}

export function buildWorkflowContext(
  workflowName: string,
  currentNode: string,
  outputs: AgentOutput[]
): WorkflowContext {
  const summary = outputs.length > 0
    ? outputs.map((o) => `【${o.nodeLabel}】: ${truncate(o.content, 120)}`).join('\n')
    : '（无上游输出）'

  return {
    workflowName,
    currentNode,
    outputs,
    summary,
    totalTokens: outputs.reduce((sum, o) => sum + o.tokenEstimate, 0)
  }
}

export function resolvePromptWithContext(
  template: string,
  outputs: AgentOutput[],
  input: string,
  context: WorkflowContext
): string {
  let result = template
    .replace(/\{\{input\}\}/g, input)
    .replace(/\{\{summary\}\}/g, context.summary)
    .replace(/\{\{context\}\}/g, JSON.stringify(context, null, 2))

  // Replace {{$nodeId}} with node output content
  result = result.replace(/\{\{\$(\w+)\}\}/g, (_, id) => {
    const output = outputs.find((o) => o.nodeId === id)
    return output?.content || ''
  })

  // Replace {{node:N.field}} references
  result = result.replace(/\{\{node:(\w+)\.(label|content|duration|tokens)\}\}/g, (_, id, field) => {
    const output = outputs.find((o) => o.nodeId === id)
    if (!output) return ''
    switch (field) {
      case 'label': return output.nodeLabel
      case 'content': return output.content
      case 'duration': return `${(output.durationMs / 1000).toFixed(1)}s`
      case 'tokens': return `~${output.tokenEstimate}`
      default: return ''
    }
  })

  return result
}

export function buildSystemPromptForWorkflow(
  basePrompt: string | undefined,
  soulPrompt: string | undefined,
  context: WorkflowContext
): string {
  const parts: string[] = []

  if (soulPrompt) parts.push(soulPrompt)

  if (basePrompt) parts.push(basePrompt)

  parts.push(`[工作流上下文]
工作流: ${context.workflowName}
当前节点: ${context.currentNode}
上游节点数: ${context.outputs.length}
预估总 token: ~${context.totalTokens}`)
  if (context.outputs.length > 0) {
    parts.push(`上游摘要:\n${context.summary}`)
  }

  return parts.join('\n\n')
}

// Chat context compression for long conversations

const MAX_CONTEXT_CHARS = 30000
const KEEP_RECENT_MESSAGES = 6

export function compressChatContext(messages: ChatMessage[]): ChatMessage[] {
  const filtered = messages.filter((m) => m.role !== 'system' && m.role !== 'error')
  if (filtered.length <= KEEP_RECENT_MESSAGES + 2) return filtered

  const totalChars = filtered.reduce((sum, m) => sum + m.content.length, 0)
  if (totalChars <= MAX_CONTEXT_CHARS) return filtered

  // Split into older (compress) and recent (keep intact)
  const recent = filtered.slice(-KEEP_RECENT_MESSAGES)
  const older = filtered.slice(0, -KEEP_RECENT_MESSAGES)

  // Create a summary of older messages
  const summary = compressOlderMessages(older)

  return [
    {
      id: genId('context-summary-'),
      role: 'agent',
      content: `[历史对话摘要]\n${summary}`,
      timestamp: older[older.length - 1]?.timestamp || Date.now()
    },
    ...recent
  ]
}

function compressOlderMessages(messages: ChatMessage[]): string {
  const userMessages = messages.filter((m) => m.role === 'user')
  const agentMessages = messages.filter((m) => m.role === 'agent')

  const topics = userMessages.map((m, i) => {
    const reply = agentMessages[i]
    const userBrief = truncate(m.content, 80)
    const replyBrief = reply ? truncate(reply.content, 80) : '（无回复）'
    return `Q: ${userBrief}\nA: ${replyBrief}`
  })

  if (topics.length > 10) {
    return topics.slice(0, 5).join('\n\n') + `\n\n... (省略 ${topics.length - 5} 条) ...\n\n` + topics.slice(-3).join('\n\n')
  }
  return topics.join('\n\n')
}

export function getContextUsageInfo(messages: ChatMessage[]): {
  totalChars: number
  estimatedTokens: number
  messageCount: number
  isCompressed: boolean
} {
  const filtered = messages.filter((m) => m.role !== 'system' && m.role !== 'error')
  const totalChars = filtered.reduce((sum, m) => sum + m.content.length, 0)
  return {
    totalChars,
    estimatedTokens: estimateTokens(messages.reduce((s, m) => s + m.content, '')),
    messageCount: filtered.length,
    isCompressed: filtered.some((m) => m.id.startsWith('context-summary-'))
  }
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen - 3) + '...'
}
