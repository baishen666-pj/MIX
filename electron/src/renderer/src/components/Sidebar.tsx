import { useState, useRef, useEffect } from 'react'
import type { ViewMode } from '../../../shared/types'
import { useAppStore, type ThemeMode } from '../stores/app'
import { ConfirmDialog } from './ConfirmDialog'
import { useConfirm } from '../hooks/useConfirm'

interface SidebarProps {
  activeView: ViewMode
  onViewChange: (view: ViewMode) => void
}

const NAV_ITEMS: { view: ViewMode; icon: string; labelZh: string }[] = [
  { view: 'chat', icon: '💬', labelZh: '聊天' },
  { view: 'canvas', icon: '🕸️', labelZh: '画布' },
  { view: '3d', icon: '🔮', labelZh: '3D' },
  { view: 'memory', icon: '🧠', labelZh: '记忆' },
  { view: 'tools', icon: '🔧', labelZh: '工具' },
  { view: 'computer-use', icon: '🖥️', labelZh: '桌面控制' },
  { view: 'im', icon: '📱', labelZh: 'IM' },
  { view: 'schedule', icon: '⏰', labelZh: '定时' },
  { view: 'workflow', icon: '🔀', labelZh: '工作流' },
  { view: 'checkpoint', icon: '💾', labelZh: '检查点' },
  { view: 'soul', icon: '🎭', labelZh: '角色' },
  { view: 'settings', icon: '⚙️', labelZh: '设置' }
]

const THEME_ICONS: Record<ThemeMode, string> = { dark: '🌙', light: '☀️', cyberpunk: '🌃' }
const THEME_LABELS: Record<ThemeMode, string> = { dark: '暗色', light: '亮色', cyberpunk: '赛博' }
const THEME_CYCLE: ThemeMode[] = ['dark', 'light', 'cyberpunk']

export function Sidebar({ activeView, onViewChange }: SidebarProps) {
  const profiles = useAppStore((s) => s.profiles)
  const activeProfileId = useAppStore((s) => s.activeProfileId)
  const activeProfile = profiles.find((p) => p.id === activeProfileId) ?? profiles[0]
  const theme = useAppStore((s) => s.theme)
  const setTheme = useAppStore((s) => s.setTheme)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  return (
    <aside className="flex h-full w-14 flex-col items-center gap-1 border-r border-border-subtle bg-surface-base py-3" role="navigation" aria-label="主导航">
      {/* Logo / Profile switcher */}
      <div className="relative mb-4" ref={menuRef}>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex h-8 w-10 items-center justify-center rounded-lg bg-accent/20 text-xs font-bold text-accent-text transition-colors hover:bg-accent/30"
          title={activeProfile.name}
          aria-label={`配置文件: ${activeProfile.name}`}
          aria-expanded={menuOpen}
        >
          {activeProfile.name.slice(0, 1)}
        </button>

        {menuOpen && <ProfileMenu onClose={() => setMenuOpen(false)} />}
      </div>

      {/* Navigation */}
      {NAV_ITEMS.map(({ view, icon, labelZh }) => (
        <button
          key={view}
          onClick={() => onViewChange(view)}
          title={labelZh}
          aria-label={labelZh}
          aria-current={activeView === view ? 'page' : undefined}
          className={`flex h-10 w-10 items-center justify-center rounded-lg text-lg transition-colors ${
            activeView === view
              ? 'bg-accent/20 text-accent-text'
              : 'text-content-subtle hover:bg-surface-overlay hover:text-content-heading'
          }`}
        >
          {icon}
        </button>
      ))}

      {/* Theme toggle */}
      <div className="mt-auto">
        <button
          onClick={() => {
            const next = THEME_CYCLE[(THEME_CYCLE.indexOf(theme) + 1) % THEME_CYCLE.length]
            setTheme(next)
          }}
          title={`主题: ${THEME_LABELS[theme]}`}
          aria-label={`切换主题，当前: ${THEME_LABELS[theme]}`}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-lg transition-colors hover:bg-surface-overlay hover:text-content-heading"
        >
          {THEME_ICONS[theme]}
        </button>
      </div>
    </aside>
  )
}

function ProfileMenu({ onClose }: { onClose: () => void }) {
  const profiles = useAppStore((s) => s.profiles)
  const activeProfileId = useAppStore((s) => s.activeProfileId)
  const switchProfile = useAppStore((s) => s.switchProfile)
  const createProfile = useAppStore((s) => s.createProfile)
  const deleteProfile = useAppStore((s) => s.deleteProfile)
  const renameProfile = useAppStore((s) => s.renameProfile)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const { confirmState, requestConfirm, handleCancel } = useConfirm()

  const handleCreate = () => {
    if (!newName.trim()) return
    createProfile(newName.trim())
    setCreating(false)
    setNewName('')
    onClose()
  }

  const handleRename = (id: string) => {
    if (!editName.trim()) { setEditingId(null); return }
    renameProfile(id, editName.trim())
    setEditingId(null)
  }

  return (
    <div className="absolute left-14 top-0 z-50 w-48 rounded-lg border border-border-default bg-surface-elevated p-1.5 shadow-xl" role="menu" aria-label="配置文件菜单">
      <div className="mb-1 px-2 text-[10px] font-medium uppercase tracking-wider text-content-subtle">
        配置文件
      </div>

      {profiles.map((p) => (
        <div key={p.id} className="group flex items-center gap-1">
          {editingId === p.id ? (
            <input
              autoFocus
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={() => handleRename(p.id)}
              onKeyDown={(e) => e.key === 'Enter' && handleRename(p.id)}
              className="flex-1 rounded bg-surface-overlay px-2 py-1 text-xs text-content-heading outline-none"
            />
          ) : (
            <button
              onClick={() => { switchProfile(p.id); onClose() }}
              className={`flex flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors ${
                activeProfileId === p.id
                  ? 'bg-accent/15 text-accent-text'
                  : 'text-content-muted hover:bg-surface-overlay hover:text-content-secondary'
              }`}
            >
              <span className="flex h-5 w-5 items-center justify-center rounded bg-surface-overlay text-[10px] font-bold">
                {p.name.slice(0, 1)}
              </span>
              <span className="flex-1 truncate">{p.name}</span>
              {activeProfileId === p.id && <span className="h-1.5 w-1.5 rounded-full bg-success" />}
            </button>
          )}

          {editingId !== p.id && (
            <div className="hidden gap-0.5 group-hover:flex">
              <button
                onClick={() => { setEditingId(p.id); setEditName(p.name) }}
                className="rounded p-0.5 text-[10px] text-content-subtle hover:text-content-heading"
                title="重命名"
              >
                ✎
              </button>
              {profiles.length > 1 && (
                <button
                  onClick={() => { requestConfirm('删除配置文件', `确定删除配置文件「${p.name}」？`).then((ok) => { if (ok) deleteProfile(p.id) }) }}
                  className="rounded p-0.5 text-[10px] text-content-subtle hover:text-danger"
                  title="删除"
                >
                  ✕
                </button>
              )}
            </div>
          )}
        </div>
      ))}

      {creating ? (
        <div className="mt-1 flex gap-1">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="名称..."
            className="flex-1 rounded bg-surface-overlay px-2 py-1 text-xs text-content-heading outline-none"
          />
          <button onClick={handleCreate} className="text-xs text-accent-text">✓</button>
        </div>
      ) : (
        <button
          onClick={() => setCreating(true)}
          className="mt-1 w-full rounded-md px-2 py-1.5 text-left text-xs text-content-subtle transition-colors hover:bg-surface-overlay hover:text-content-muted"
        >
          + 新建配置文件
        </button>
      )}
      <ConfirmDialog {...confirmState} onCancel={handleCancel} />
    </div>
  )
}
