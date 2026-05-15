import { useState, useEffect, useCallback } from 'react'
import { ConfirmDialog } from './ConfirmDialog'
import { useConfirm } from '../hooks/useConfirm'

interface SessionInfo {
  id: string
  title: string
  started_at: number
  message_count: number
}

interface SessionSidebarProps {
  activeSessionId: string | null
  onSelectSession: (id: string) => void
  onNewChat: () => void
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '刚刚'
  if (mins < 60) return `${mins}分钟前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}天前`
  return new Date(ts).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

export function SessionSidebar({ activeSessionId, onSelectSession, onNewChat }: SessionSidebarProps) {
  const [sessions, setSessions] = useState<SessionInfo[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<{ session_id: string; title: string; snippet: string }[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const { confirmState, requestConfirm, handleCancel } = useConfirm()

  const loadSessions = useCallback(async () => {
    if (!window.mixDesktop) return
    try { const list = await window.mixDesktop.sessionsList(50); setSessions(list as SessionInfo[]) }
    catch { /* no db yet */ }
  }, [])

  useEffect(() => { loadSessions() }, [loadSessions])

  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query)
    if (!query.trim() || !window.mixDesktop) { setSearchResults([]); return }
    try { const results = await window.mixDesktop.sessionsSearch(query, 10); setSearchResults(results as { session_id: string; title: string; snippet: string }[]) }
    catch { setSearchResults([]) }
  }, [])

  const handleDelete = useCallback(async (id: string) => {
    if (!window.mixDesktop) return
    await window.mixDesktop.sessionsDelete(id)
    loadSessions()
  }, [loadSessions])

  const handleRename = useCallback(async (id: string, title: string) => {
    if (!window.mixDesktop || !title.trim()) return
    await window.mixDesktop.sessionsUpdateTitle(id, title.trim())
    setEditingId(null)
    loadSessions()
  }, [loadSessions])

  const startEditing = useCallback((s: SessionInfo) => {
    setEditingId(s.id)
    setEditTitle(s.title)
  }, [])

  const displayList = searchQuery ? searchResults.map((r) => ({
    id: r.session_id, title: r.title, started_at: 0, message_count: 0, snippet: r.snippet
  })) : sessions

  return (
    <div className="flex h-full w-56 flex-col border-r border-border-subtle bg-surface-base">
      <div className="p-2">
        <button onClick={onNewChat} className="w-full rounded-lg border border-border-default bg-surface-elevated px-3 py-2 text-xs text-content-muted transition-colors hover:border-accent/50 hover:text-content-heading">
          + 新对话
        </button>
      </div>

      <div className="px-2 pb-2">
        <input
          type="text" value={searchQuery} onChange={(e) => handleSearch(e.target.value)}
          placeholder="搜索历史..."
          className="w-full rounded border border-border-subtle bg-surface-elevated px-2 py-1 text-xs text-content-muted placeholder-content-subtle outline-none transition-colors focus:border-border-default"
        />
      </div>

      <div className="flex-1 overflow-y-auto px-1">
        {displayList.length === 0 && (
          <p className="px-2 py-4 text-center text-[10px] text-content-subtle">{searchQuery ? '无匹配结果' : '暂无历史对话'}</p>
        )}
        {displayList.map((s) => (
          <div
            key={s.id}
            onClick={() => { if (editingId !== s.id) onSelectSession(s.id) }}
            className={`group mb-0.5 w-full cursor-pointer rounded-lg px-2 py-2 text-left transition-colors ${
              activeSessionId === s.id ? 'bg-accent/15 text-content-heading' : 'text-content-subtle hover:bg-surface-elevated hover:text-content-muted'
            }`}
          >
            <div className="flex items-center justify-between">
              {editingId === s.id ? (
                <input
                  type="text" value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleRename(s.id, editTitle); if (e.key === 'Escape') setEditingId(null) }}
                  onBlur={() => handleRename(s.id, editTitle)}
                  className="flex-1 rounded border border-accent bg-surface-overlay px-1 py-0.5 text-xs text-content-heading outline-none"
                  autoFocus onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span
                  className="truncate text-xs"
                  onDoubleClick={(e) => { e.stopPropagation(); startEditing(s as SessionInfo) }}
                >
                  {s.title}
                </span>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); requestConfirm('删除对话', '确定删除此对话？').then((ok) => { if (ok) handleDelete(s.id) }) }}
                className="shrink-0 rounded p-0.5 text-[10px] text-content-subtle opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
              >
                ✕
              </button>
            </div>
            {'snippet' in s && (s.snippet as string | undefined) && (
              <p className="mt-1 line-clamp-2 text-[10px] text-content-subtle">
                {(s.snippet as string).split(/<<(.*?)>>/g).map((part, i) =>
                  i % 2 === 1 ? <span key={i} className="text-accent-text">{part}</span> : <span key={i}>{part}</span>
                )}
              </p>
            )}
            {'started_at' in s && s.started_at ? (
              <span className="text-[10px] text-content-subtle">
                {relativeTime(s.started_at)} · {s.message_count}条
              </span>
            ) : null}
          </div>
        ))}
      </div>
      <ConfirmDialog {...confirmState} onCancel={handleCancel} />
    </div>
  )
}
