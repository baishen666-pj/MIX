import { useRef, useEffect, useCallback } from 'react'
import { useAppStore } from '../stores/app'
import type { ChatApprovalRequest } from '../stores/app'
import { CATEGORY_LABELS } from '../lib/approvalDetection'
import { genId } from '../lib/genId'
import type { ChatMessage } from '../../../shared/types'

interface UseApprovalHandlerProps {
  chatApproval: ChatApprovalRequest | null
  addMessage: (msg: ChatMessage) => void
  setLoading: (v: boolean) => void
  isStreamingRef: React.MutableRefObject<boolean>
  agentBufferRef: React.MutableRefObject<string>
}

export function useApprovalHandler({
  chatApproval,
  addMessage,
  setLoading,
  isStreamingRef,
  agentBufferRef,
}: UseApprovalHandlerProps) {
  const prevChatApprovalStatusRef = useRef<string>('none')

  const handleApprovalFollowUp = useCallback((result: 'approved' | 'rejected') => {
    if (!window.mixDesktop) return
    const prompt = result === 'approved'
      ? '用户已批准你的操作请求。请继续执行上述操作。'
      : '用户拒绝了你的操作请求。请不要执行此操作，并提供替代方案。'
    const sid = useAppStore.getState().sessionId
    if (!sid) return

    const userMsg: ChatMessage = {
      id: genId('user-'), role: 'user', content: prompt, timestamp: Date.now()
    }
    addMessage(userMsg)
    setLoading(true)
    isStreamingRef.current = true
    agentBufferRef.current = ''

    const currentMessages = useAppStore.getState().messages
    const apiMsgs = [
      ...currentMessages.filter((m) => m.role !== 'system' && m.role !== 'error').map((m) => ({
        role: m.role === 'user' ? 'user' as const : 'assistant' as const,
        content: m.content
      })),
      { role: 'user' as const, content: prompt }
    ]
    const soul = useAppStore.getState().soulPrompt
    const finalMsgs = soul ? [{ role: 'system', content: soul }, ...apiMsgs] : apiMsgs

    window.mixDesktop.chatSend({ messages: finalMsgs }).catch(() => {
      addMessage({ id: genId('error-'), role: 'error', content: '发送后续消息失败', timestamp: Date.now() })
      setLoading(false)
    })
  }, [addMessage, setLoading])

  useEffect(() => {
    if (!chatApproval) {
      prevChatApprovalStatusRef.current = 'none'
      return
    }
    if (chatApproval.status === 'pending') {
      prevChatApprovalStatusRef.current = 'pending'
      return
    }
    if (prevChatApprovalStatusRef.current !== 'pending') return
    prevChatApprovalStatusRef.current = chatApproval.status

    const categoryLabel = CATEGORY_LABELS[chatApproval.category]
    if (chatApproval.status === 'approved') {
      addMessage({
        id: genId('system-'), role: 'system',
        content: `✅ 已批准${categoryLabel}操作，AI 将继续执行`,
        timestamp: Date.now()
      })
      handleApprovalFollowUp('approved')
    } else {
      addMessage({
        id: genId('system-'), role: 'system',
        content: `❌ 已拒绝${categoryLabel}操作，AI 将取消执行`,
        timestamp: Date.now()
      })
      handleApprovalFollowUp('rejected')
    }
    setTimeout(() => {
      useAppStore.setState({ chatApproval: null })
    }, 100)
  }, [chatApproval])

  return { handleApprovalFollowUp }
}
