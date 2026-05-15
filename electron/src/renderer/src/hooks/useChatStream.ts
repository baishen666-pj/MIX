import { useRef, useEffect, useCallback } from 'react'
import { useAppStore } from '../stores/app'
import { detectDangerousContent, CATEGORY_LABELS } from '../lib/approvalDetection'
import { genId } from '../lib/genId'
import type { ChatMessage } from '../../../shared/types'
import type { ToolCall, ToolResult } from '../../../shared/types'

export function useChatStream(
  appendToLastAgent: (chunk: string) => void,
  setLoading: (v: boolean) => void,
  setToolProgress: (v: string | null) => void,
  addMessage: (msg: ChatMessage) => void,
  appendReasoning: (text: string) => void,
  clearReasoning: () => void,
  notify: (title: string, body: string) => void,
  isAiConfigMode: boolean,
  sessionId: string | null
) {
  const agentBufferRef = useRef('')
  const streamBufferRef = useRef('')
  const rafIdRef = useRef(0)
  const isStreamingRef = useRef(false)

  const flushStreamBuffer = useCallback(() => {
    const chunk = streamBufferRef.current
    if (chunk) {
      streamBufferRef.current = ''
      appendToLastAgent(chunk)
      agentBufferRef.current += chunk
    }
  }, [appendToLastAgent])

  const scheduleFlush = useCallback(() => {
    if (rafIdRef.current) return
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = 0
      flushStreamBuffer()
    })
  }, [flushStreamBuffer])

  const persistAgentMessage = useCallback(async (content: string) => {
    if (!window.mixDesktop || !content || !sessionId) return
    try {
      await window.mixDesktop.sessionsInsertMessage({
        id: genId('agent-'), session_id: sessionId, role: 'agent', content, timestamp: Date.now()
      })
    } catch { /* silent */ }
  }, [sessionId])

  const submitChatApproval = useAppStore.getState().submitChatApproval

  useEffect(() => {
    if (!window.mixDesktop) return
    const unsubChunk = window.mixDesktop.onChatChunk((chunk: string) => {
      if (isAiConfigMode) return
      streamBufferRef.current += chunk
      scheduleFlush()
    })
    const unsubDone = () => {
      if (isAiConfigMode) return
      if (rafIdRef.current) { cancelAnimationFrame(rafIdRef.current); rafIdRef.current = 0 }
      flushStreamBuffer()
      isStreamingRef.current = false
      setLoading(false)
      setToolProgress(null)
      const finalContent = agentBufferRef.current
      persistAgentMessage(finalContent)
      agentBufferRef.current = ''

      if (finalContent) {
        const detection = detectDangerousContent(finalContent)
        if (detection.detected) {
          const lastMsgId = useAppStore.getState().messages[useAppStore.getState().messages.length - 1]?.id || genId('agent-')
          submitChatApproval({
            messageId: lastMsgId,
            content: finalContent,
            category: detection.category!,
            summary: detection.summary,
            confidence: detection.confidence,
            matchedPattern: detection.matchedPattern
          })
          const categoryLabel = CATEGORY_LABELS[detection.category!]
          addMessage({
            id: genId('system-'), role: 'system',
            content: `⚠️ 检测到${categoryLabel}操作「${detection.summary}」，等待审批确认`,
            timestamp: Date.now()
          })
          notify('需要审批', `AI 尝试${categoryLabel}：${detection.summary}`)
        }
      }
    }
    const unsubError = (msg: string) => {
      if (isAiConfigMode) return
      addMessage({ id: genId('error-'), role: 'error', content: msg, timestamp: Date.now() })
      setLoading(false)
      notify('聊天错误', msg.slice(0, 100))
    }
    const unsubTool = (tool: string) => { if (!isAiConfigMode) setToolProgress(tool) }
    const unsubReasoning = (text: string) => { if (!isAiConfigMode) appendReasoning(text) }
    const doneHandler = (): void => { unsubDone(); clearReasoning() }
    const unsubDoneEvt = window.mixDesktop.onChatDone(doneHandler)
    const unsubErrorEvt = window.mixDesktop.onChatError(unsubError)
    const unsubChunkEvt = window.mixDesktop.onChatChunk(unsubChunk)
    const unsubToolEvt = window.mixDesktop.onToolProgress(unsubTool)
    const unsubReasoningEvt = window.mixDesktop.onChatReasoning(unsubReasoning)

    // Tool call events
    const unsubToolCallStart = window.mixDesktop.onToolCallStart?.((call: { id: string; name: string }) => {
      if (isAiConfigMode) return
      useAppStore.getState().addToolCall({ id: call.id, name: call.name, arguments: '' })
    })
    const unsubToolCallResult = window.mixDesktop.onToolCallResult?.((result: { id: string; name: string; ok: boolean; data: unknown }) => {
      if (isAiConfigMode) return
      const toolResult: ToolResult = {
        toolCallId: result.id,
        name: result.name,
        result: typeof result.data === 'string' ? result.data : JSON.stringify(result.data),
        ok: result.ok
      }
      useAppStore.getState().addToolResult(toolResult)
    })

    return () => {
      unsubDoneEvt(); unsubErrorEvt(); unsubChunkEvt(); unsubToolEvt(); unsubReasoningEvt()
      unsubToolCallStart?.(); unsubToolCallResult?.()
    }
  }, [appendToLastAgent, setLoading, setToolProgress, addMessage, appendReasoning, clearReasoning, flushStreamBuffer, scheduleFlush, isAiConfigMode])

  return { agentBufferRef, isStreamingRef }
}
