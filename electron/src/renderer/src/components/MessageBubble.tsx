import { useState, memo } from 'react'
import type { ChatMessage, ToolCall, ToolResult } from '../../../shared/types'
import { AgentMarkdown } from './AgentMarkdown'

const UserIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
)

const BotIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/><line x1="9" y1="19" x2="15" y2="19"/></svg>
)

export const MessageBubble = memo(function MessageBubble({ msg, onDelete, onCopy, onEdit }: {
  msg: ChatMessage
  onDelete: (id: string) => void
  onCopy: (text: string) => void
  onEdit?: (id: string, newContent: string) => void
}) {
  const [showActions, setShowActions] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState('')
  const time = new Date(msg.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })

  const startEdit = () => { setEditing(true); setEditText(msg.content) }
  const saveEdit = () => { if (editText.trim() && editText !== msg.content) onEdit?.(msg.id, editText.trim()); setEditing(false) }

  if (msg.role === 'user') {
    return (
      <div className="group mb-3 animate-msg-in" onMouseEnter={() => setShowActions(true)} onMouseLeave={() => setShowActions(false)}>
        <div className="flex items-start justify-end gap-2">
          <div className="flex flex-col items-end">
            {msg.imageBase64 && (
              <div className="mb-1">
                <img src={msg.imageBase64} alt="" className="max-h-48 rounded-lg border border-accent/30" />
              </div>
            )}
            {editing ? (
              <div className="flex max-w-[75%] items-center gap-1">
                <input
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditing(false) }}
                  className="flex-1 rounded-lg border border-accent bg-surface-elevated px-2 py-1 text-sm text-content-heading outline-none"
                  autoFocus
                />
                <button onClick={saveEdit} className="rounded bg-accent px-2 py-1 text-[10px] text-white">发送</button>
                <button onClick={() => setEditing(false)} className="rounded px-2 py-1 text-[10px] text-content-subtle hover:bg-surface-overlay">取消</button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                {showActions && (
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => onCopy(msg.content)} className="rounded p-1 text-[10px] text-content-subtle hover:bg-surface-overlay hover:text-content-muted">复制</button>
                    <button onClick={startEdit} className="rounded p-1 text-[10px] text-content-subtle hover:bg-surface-overlay hover:text-accent-text">编辑</button>
                    <button onClick={() => onDelete(msg.id)} className="rounded p-1 text-[10px] text-content-subtle hover:bg-surface-overlay hover:text-danger">删除</button>
                  </div>
                )}
                <span className="inline-block max-w-[75%] rounded-2xl rounded-tr-sm bg-accent px-3 py-2 text-sm text-white shadow-sm">{msg.content}</span>
              </div>
            )}
            <span className="mt-0.5 text-[10px] text-content-subtle opacity-0 group-hover:opacity-100 transition-opacity">{time}</span>
          </div>
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/20 text-accent-text"><UserIcon /></div>
        </div>
      </div>
    )
  }

  if (msg.role === 'error') {
    return (
      <div className="group mb-3 animate-msg-in" onMouseEnter={() => setShowActions(true)} onMouseLeave={() => setShowActions(false)}>
        <div className="flex items-start gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-danger-bg text-danger">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          </div>
          <div>
            <span className="inline-block max-w-[75%] rounded-2xl rounded-tl-sm bg-danger-bg px-3 py-2 text-sm text-danger">{msg.content}</span>
            <div className="mt-0.5 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-[10px] text-content-subtle">{time}</span>
              {showActions && <button onClick={() => onDelete(msg.id)} className="rounded p-0.5 text-[10px] text-content-subtle hover:text-danger">删除</button>}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (msg.role === 'system') {
    return <div className="mb-3 animate-msg-in text-center"><span className="inline-block rounded-full bg-surface-overlay px-3 py-1 text-xs text-content-subtle">{msg.content}</span></div>
  }

  return (
    <div className="group mb-3 animate-msg-in" onMouseEnter={() => setShowActions(true)} onMouseLeave={() => setShowActions(false)}>
      <div className="flex items-start gap-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-overlay text-accent-text"><BotIcon /></div>
        <div>
          <div className="inline-block max-w-[85%] rounded-2xl rounded-tl-sm bg-surface-overlay/50 px-4 py-2 shadow-sm">
            <AgentMarkdown content={msg.content} />
          </div>
          <div className="mt-0.5 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-[10px] text-content-subtle">{time}</span>
            <div className="flex gap-1">
              <button onClick={() => onCopy(msg.content)} className="rounded p-0.5 text-[10px] text-content-subtle hover:bg-surface-overlay hover:text-content-muted">复制</button>
              <button onClick={() => onDelete(msg.id)} className="rounded p-0.5 text-[10px] text-content-subtle hover:bg-surface-overlay hover:text-danger">删除</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})

export function ToolCallCard({ calls, results }: { calls: ToolCall[]; results: ToolResult[] }) {
  const [expanded, setExpanded] = useState(false)
  if (calls.length === 0) return null

  return (
    <div className="mb-2 max-w-[85%]">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 rounded-lg border border-accent/30 bg-accent/5 px-3 py-1.5 text-xs text-accent-text transition-colors hover:bg-accent/10"
      >
        <span className={`transition-transform ${expanded ? 'rotate-90' : ''}`}>▸</span>
        <span>{calls.length} 个工具调用</span>
        {results.length > 0 && (
          <span className="text-content-subtle">
            ({results.filter(r => r.ok).length}/{results.length} 成功)
          </span>
        )}
      </button>
      {expanded && (
        <div className="mt-1 space-y-1">
          {calls.map((tc) => {
            const result = results.find(r => r.toolCallId === tc.id)
            return (
              <div key={tc.id} className="rounded-lg border border-border-subtle bg-surface-elevated/80 p-2 text-xs">
                <div className="flex items-center gap-2 font-medium text-content-muted">
                  <span>{tc.name}</span>
                  {result && (
                    <span className={result.ok ? 'text-green-500' : 'text-danger'}>
                      {result.ok ? '成功' : '失败'}
                    </span>
                  )}
                </div>
                {result && (
                  <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap text-content-subtle">
                    {result.result.slice(0, 500)}
                  </pre>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function ReasoningBlock({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false)
  if (!content) return null
  return (
    <div className="mb-2 max-w-[85%]">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 rounded-lg border border-border-subtle bg-surface-elevated/50 px-3 py-1.5 text-xs text-content-subtle transition-colors hover:text-content-muted"
      >
        <span className={`transition-transform ${expanded ? 'rotate-90' : ''}`}>▸</span>
        <span>思考过程</span>
        <span className="text-content-subtle">({content.length}字)</span>
      </button>
      {expanded && (
        <div className="mt-1 rounded-lg border border-border-subtle bg-surface-elevated/80 p-3 text-xs leading-relaxed text-content-subtle whitespace-pre-wrap">
          {content}
        </div>
      )}
    </div>
  )
}
