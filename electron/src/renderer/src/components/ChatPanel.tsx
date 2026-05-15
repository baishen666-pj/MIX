import { useState, useRef, useEffect, useCallback } from 'react'
import { useAppStore } from '../stores/app'
import type { SlashCommand } from './SlashCommandMenu'
import type { ChatMessage } from '../../../shared/types'
import { getContextUsageInfo } from '../lib/contextManager'
import { genId } from '../lib/genId'
import { ChatEmptyState } from './ChatEmptyState'
import { ChatExportDialog } from './ChatExportDialog'
import { ChatApprovalBar } from './ChatApprovalBar'
import { useChatStream } from '../hooks/useChatStream'
import { useApprovalHandler } from '../hooks/useApprovalHandler'
import { useExportChat } from '../hooks/useExportChat'
import { useChatSend } from '../hooks/useChatSend'
import { ChatMessages } from './chat/ChatMessages'
import { ChatInput } from './chat/ChatInput'
import { ModelSwitcher } from './chat/ModelSwitcher'

export function ChatPanel() {
  const messages = useAppStore((s) => s.messages)
  const isLoading = useAppStore((s) => s.isLoading)
  const toolProgress = useAppStore((s) => s.toolProgress)
  const sessionId = useAppStore((s) => s.sessionId)
  const reasoningContent = useAppStore((s) => s.reasoningContent)
  const soulPrompt = useAppStore((s) => s.soulPrompt)
  const chatApproval = useAppStore((s) => s.chatApproval)
  const addMessage = useAppStore((s) => s.addMessage)
  const appendToLastAgent = useAppStore((s) => s.appendToLastAgent)
  const setLoading = useAppStore((s) => s.setLoading)
  const setToolProgress = useAppStore((s) => s.setToolProgress)
  const clearMessages = useAppStore((s) => s.clearMessages)
  const setSessionId = useAppStore((s) => s.setSessionId)
  const setView = useAppStore((s) => s.setView)
  const appendReasoning = useAppStore((s) => s.appendReasoning)
  const clearReasoning = useAppStore((s) => s.clearReasoning)
  const notify = useAppStore((s) => s.notify)
  const respondChatApproval = useAppStore((s) => s.respondChatApproval)
  const isAiConfigMode = useAppStore((s) => s.isAiConfigMode)

  const [input, setInput] = useState('')
  const [slashMenuOpen, setSlashMenuOpen] = useState(false)
  const [slashFilter, setSlashFilter] = useState('')
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })
  const [pendingImage, setPendingImage] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { agentBufferRef, isStreamingRef } = useChatStream(
    appendToLastAgent, setLoading, setToolProgress, addMessage,
    appendReasoning, clearReasoning, notify,
    isAiConfigMode, sessionId
  )

  useApprovalHandler({ chatApproval, addMessage, setLoading, isStreamingRef, agentBufferRef })

  const { exportOpen, setExportOpen, exportFormat, setExportFormat, handleExport } = useExportChat({
    messages, sessionId, notify
  })

  const { sendChat } = useChatSend({
    sessionId, addMessage, setLoading, appendToLastAgent, setSessionId,
    agentBufferRef, isStreamingRef,
  })

  useEffect(() => {
    if (isStreamingRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'auto' })
    } else {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isLoading])

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setPendingImage(reader.result as string)
    reader.readAsDataURL(file)
    e.target.value = ''
  }, [])

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData.items
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const blob = item.getAsFile()
        if (!blob) return
        const reader = new FileReader()
        reader.onload = () => setPendingImage(reader.result as string)
        reader.readAsDataURL(blob)
        return
      }
    }
  }, [])

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if ((!text && !pendingImage) || isLoading) return
    setInput('')
    setPendingImage(null)
    setSlashMenuOpen(false)
    await sendChat(text, pendingImage, isLoading)
  }, [input, isLoading, pendingImage, sendChat])

  const handleSlashCommand = useCallback((cmd: SlashCommand) => {
    setSlashMenuOpen(false); setInput('')
    switch (cmd.key) {
      case 'new': case 'clear': clearMessages(); break
      case 'canvas': setView('canvas'); break
      case '3d': setView('3d'); break
      case 'memory': setView('memory'); break
      case 'tools': setView('tools'); break
      case 'schedule': setView('schedule'); break
      case 'workflow': setView('workflow'); break
      case 'checkpoint': setView('checkpoint'); break
      case 'soul': setView('soul'); break
      case 'settings': setView('settings'); break
      case 'approve': {
        const rooms = useAppStore.getState().projectRooms
        if (rooms.length === 0) {
          addMessage({ id: genId('system-'), role: 'system', content: '请先在 3D 视图添加项目组', timestamp: Date.now() })
        } else {
          const room = rooms[0]
          const member = room.members[0]
          useAppStore.getState().submitApproval({
            fromMemberId: member.id,
            fromMemberName: member.name,
            fromProjectId: room.id,
            fromProjectName: room.name,
            title: '测试审批请求',
            description: '这是一条测试审批，用于验证员工→老板的审批流程。批准后员工将返回岗位。'
          })
          addMessage({ id: genId('system-'), role: 'system', content: `📋 ${member.name} 正在前往老板办公室提交审批...`, timestamp: Date.now() })
        }
        break
      }
      default: addMessage({ id: genId('system-'), role: 'system', content: `${cmd.label} — ${cmd.description}`, timestamp: Date.now() })
    }
    inputRef.current?.focus()
  }, [clearMessages, setView, addMessage])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value; setInput(val)
    if (val === '/') { setSlashMenuOpen(true); setSlashFilter(''); updateMenuPosition() }
    else if (val.startsWith('/') && slashMenuOpen) setSlashFilter(val.slice(1))
    else setSlashMenuOpen(false)
  }, [slashMenuOpen])

  const updateMenuPosition = useCallback(() => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect()
      setMenuPos({ top: rect.top - 260, left: rect.left })
    }
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (slashMenuOpen && ['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(e.key)) return
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!input.startsWith('/')) handleSend() }
  }, [slashMenuOpen, input, handleSend])

  const handleDeleteMessage = useCallback((id: string) => {
    const store = useAppStore.getState()
    useAppStore.setState({ messages: store.messages.filter((m) => m.id !== id) })
  }, [])

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-border-subtle px-4 py-2">
        <h2 className="text-sm font-medium text-content-heading">{sessionId ? '对话' : 'AI GUI'}</h2>
        <div className="flex items-center gap-3">
          <ModelSwitcher onOpenSettings={() => setView('settings')} />
          {soulPrompt && (
            <button
              onClick={() => setView('soul')}
              className="flex items-center gap-1 rounded-full border border-border-subtle bg-surface-elevated px-2 py-0.5 text-[10px] text-content-subtle transition-colors hover:border-border-default hover:text-content-heading"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-accent-text" />
              角色已启用
            </button>
          )}
          <ContextIndicator messages={messages} />
          <div className="flex gap-2">
          {isLoading && (
            <button onClick={() => window.mixDesktop?.chatAbort()} className="rounded px-2 py-1 text-xs text-danger hover:bg-surface-overlay">停止</button>
          )}
          {messages.length > 0 && (
            <button onClick={() => setExportOpen(true)} className="rounded px-2 py-1 text-xs text-content-subtle hover:bg-surface-overlay hover:text-content-heading" title="导出对话">导出</button>
          )}
          <button onClick={clearMessages} className="rounded px-2 py-1 text-xs text-content-subtle hover:bg-surface-overlay hover:text-content-heading">新对话</button>
          </div>
        </div>
      </header>

      {messages.length === 0 && <ChatEmptyState />}

      <ChatMessages
        messages={messages}
        isLoading={isLoading}
        toolProgress={toolProgress}
        reasoningContent={reasoningContent}
        onDeleteMessage={handleDeleteMessage}
        bottomRef={bottomRef}
      />

      {exportOpen && (
        <ChatExportDialog
          messages={messages}
          sessionId={sessionId}
          format={exportFormat}
          onFormatChange={setExportFormat}
          onExport={handleExport}
          onClose={() => setExportOpen(false)}
        />
      )}

      {chatApproval?.status === 'pending' && (
        <ChatApprovalBar
          summary={chatApproval.summary}
          confidence={chatApproval.confidence}
          category={chatApproval.category}
          onApprove={() => respondChatApproval(true)}
          onReject={() => respondChatApproval(false)}
        />
      )}

      <ChatInput
        input={input}
        onInputChange={handleInputChange}
        isLoading={isLoading}
        pendingImage={pendingImage}
        onSend={handleSend}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onImageUpload={handleImageUpload}
        onRemovePendingImage={() => setPendingImage(null)}
        slashMenuOpen={slashMenuOpen}
        slashFilter={slashFilter}
        menuPos={menuPos}
        onSlashCommand={handleSlashCommand}
        onSlashMenuClose={() => setSlashMenuOpen(false)}
        inputRef={inputRef}
        fileInputRef={fileInputRef}
      />
    </div>
  )
}

function ContextIndicator({ messages }: { messages: ChatMessage[] }) {
  const info = getContextUsageInfo(messages)
  if (info.messageCount === 0) return null
  const usagePercent = Math.min(100, Math.round((info.estimatedTokens / 10000) * 100))
  const barColor = usagePercent > 80 ? 'bg-danger' : usagePercent > 50 ? 'bg-warning' : 'bg-success'
  return (
    <div className="flex items-center gap-1.5" title={`${info.estimatedTokens} tokens · ${info.messageCount} 条消息`}>
      <div className="h-1 w-12 rounded-full bg-surface-inset overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${usagePercent}%` }} />
      </div>
      <span className="text-[10px] text-content-subtle">
        {info.estimatedTokens > 1000 ? `${(info.estimatedTokens / 1000).toFixed(1)}k` : info.estimatedTokens}
      </span>
    </div>
  )
}
