import { useState, useEffect, useCallback } from 'react'
import { genId } from '../lib/genId'

interface MemoryEntry {
  id: string
  content: string
  timestamp: number
  type: 'fact' | 'preference' | 'context' | 'instruction'
}

const TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  fact: { label: '事实', color: 'bg-blue-500/20 text-blue-400' },
  preference: { label: '偏好', color: 'bg-purple-500/20 text-purple-400' },
  context: { label: '上下文', color: 'bg-warning-bg text-warning' },
  instruction: { label: '指令', color: 'bg-success-bg text-success' }
}

export function MemoryPanel() {
  const [memories, setMemories] = useState<MemoryEntry[]>([])
  const [newContent, setNewContent] = useState('')
  const [newType, setNewType] = useState<MemoryEntry['type']>('fact')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [userProfile, setUserProfile] = useState('')
  const [editProfile, setEditProfile] = useState(false)
  const [profileContent, setProfileContent] = useState('')

  const loadEntries = useCallback(async () => {
    if (!window.mixDesktop) return
    try {
      const entries = await window.mixDesktop.memoryReadEntries() as MemoryEntry[]
      setMemories(entries)
    } catch {
      setMemories([])
    }
    setLoading(false)
  }, [])

  const loadProfile = useCallback(async () => {
    if (!window.mixDesktop) return
    try {
      const profile = await window.mixDesktop.memoryReadUserProfile()
      setUserProfile(profile)
      setProfileContent(profile)
    } catch {
      setUserProfile('')
      setProfileContent('')
    }
  }, [])

  useEffect(() => {
    loadEntries()
    loadProfile()
  }, [loadEntries, loadProfile])

  const handleAdd = useCallback(async () => {
    if (!newContent.trim() || !window.mixDesktop) return
    const entry = await window.mixDesktop.memoryAddEntry({
      content: newContent.trim(),
      type: newType,
      timestamp: Date.now()
    }) as MemoryEntry
    setMemories((prev) => [entry, ...prev])
    setNewContent('')
  }, [newContent, newType])

  const handleDelete = useCallback(async (id: string) => {
    if (!window.mixDesktop) return
    await window.mixDesktop.memoryRemoveEntry(id)
    setMemories((prev) => prev.filter((m) => m.id !== id))
  }, [])

  const handleEdit = useCallback((entry: MemoryEntry) => {
    setEditingId(entry.id)
    setEditContent(entry.content)
  }, [])

  const handleSave = useCallback(async (id: string) => {
    if (!window.mixDesktop) return
    await window.mixDesktop.memoryUpdateEntry(id, editContent)
    setMemories((prev) =>
      prev.map((m) => (m.id === id ? { ...m, content: editContent } : m))
    )
    setEditingId(null)
  }, [editContent])

  const handleSaveProfile = useCallback(async () => {
    if (!window.mixDesktop) return
    await window.mixDesktop.memoryWriteUserProfile(profileContent)
    setUserProfile(profileContent)
    setEditProfile(false)
  }, [profileContent])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="text-sm text-content-subtle">加载记忆数据...</span>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-border-subtle px-4 py-2">
        <h2 className="text-sm font-medium text-content-heading">记忆管理</h2>
      </header>

      <div className="border-b border-border-subtle p-3">
        <div className="flex gap-2">
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value as MemoryEntry['type'])}
            className="rounded border border-border-default bg-surface-overlay px-2 py-1.5 text-xs text-content-muted"
          >
            {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
              <option key={key} value={key}>{cfg.label}</option>
            ))}
          </select>
          <input
            type="text"
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="添加新记忆..."
            className="flex-1 rounded border border-border-default bg-surface-elevated px-3 py-1.5 text-sm text-content-secondary placeholder-content-subtle outline-none focus:border-accent"
          />
          <button
            onClick={handleAdd}
            disabled={!newContent.trim()}
            className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
          >
            添加
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <div className="space-y-2">
          {memories.map((entry) => {
            const tc = TYPE_CONFIG[entry.type]
            return (
              <div
                key={entry.id}
                className="group rounded-lg border border-border-subtle bg-surface-elevated p-3 transition-colors hover:border-border-default"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    {editingId === entry.id ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSave(entry.id)}
                          className="flex-1 rounded border border-accent bg-surface-overlay px-2 py-1 text-sm text-content-secondary outline-none"
                          autoFocus
                        />
                        <button
                          onClick={() => handleSave(entry.id)}
                          className="rounded bg-accent px-2 py-1 text-xs text-white"
                        >
                          保存
                        </button>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm text-content-heading">{entry.content}</p>
                        <div className="mt-2 flex items-center gap-2">
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${tc.color}`}>
                            {tc.label}
                          </span>
                          <span className="text-[10px] text-content-subtle">
                            {new Date(entry.timestamp).toLocaleString('zh-CN')}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                  {editingId !== entry.id && (
                    <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        onClick={() => handleEdit(entry)}
                        className="rounded p-1 text-xs text-content-subtle hover:bg-surface-overlay hover:text-content-muted"
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => handleDelete(entry.id)}
                        className="rounded p-1 text-xs text-content-subtle hover:bg-surface-overlay hover:text-danger"
                      >
                        删除
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* User Profile Section */}
      <div className="border-t border-border-subtle p-3">
        {editProfile ? (
          <div className="space-y-2">
            <div className="text-xs font-medium text-content-heading">用户画像</div>
            <textarea
              value={profileContent}
              onChange={(e) => setProfileContent(e.target.value)}
              className="w-full resize-none rounded border border-border-subtle bg-surface-elevated p-2 text-xs text-content-secondary outline-none focus:border-accent"
              rows={3}
              placeholder="描述用户的偏好、习惯和背景..."
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setEditProfile(false)}
                className="rounded px-2 py-1 text-xs text-content-subtle hover:bg-surface-overlay"
              >
                取消
              </button>
              <button
                onClick={handleSaveProfile}
                className="rounded bg-accent px-2 py-1 text-xs text-white"
              >
                保存
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-content-heading">用户画像</div>
              <p className="mt-0.5 truncate text-[10px] text-content-subtle">
                {userProfile || '未设置 — 点击编辑添加用户画像'}
              </p>
            </div>
            <button
              onClick={() => { setProfileContent(userProfile); setEditProfile(true) }}
              className="ml-2 shrink-0 rounded px-2 py-1 text-xs text-content-subtle hover:bg-surface-overlay hover:text-content-heading"
            >
              编辑
            </button>
          </div>
        )}
      </div>

      <div className="border-t border-border-subtle px-4 py-2">
        <p className="text-xs text-content-subtle">
          共 {memories.length} 条记忆 — 持久化存储至 MEMORY.md
        </p>
      </div>
    </div>
  )
}
