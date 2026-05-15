import { useEffect, useRef } from 'react'

interface Props {
  onClose: () => void
}

const SHORTCUTS = [
  { category: '视图切换', items: [
    { keys: 'Ctrl+1', desc: '聊天' },
    { keys: 'Ctrl+2', desc: 'Agent 画布' },
    { keys: 'Ctrl+3', desc: '3D 办公室' },
    { keys: 'Ctrl+4', desc: '记忆' },
    { keys: 'Ctrl+5', desc: '工具' },
    { keys: 'Ctrl+6', desc: '定时任务' },
    { keys: 'Ctrl+7', desc: '工作流' },
    { keys: 'Ctrl+8', desc: '角色编辑' },
    { keys: 'Ctrl+9', desc: '设置' },
  ]},
  { category: '聊天', items: [
    { keys: 'Ctrl+N', desc: '新建对话' },
    { keys: 'Enter', desc: '发送消息' },
    { keys: 'Shift+Enter', desc: '换行（不发送）' },
    { keys: '/', desc: '打开斜杠命令菜单' },
    { keys: 'Esc', desc: '关闭菜单/弹窗' },
  ]},
  { category: '斜杠命令', items: [
    { keys: '/new', desc: '新建对话' },
    { keys: '/clear', desc: '清空对话' },
    { keys: '/canvas', desc: '切换画布' },
    { keys: '/schedule', desc: '定时任务' },
    { keys: '/workflow', desc: '工作流' },
    { keys: '/soul', desc: '角色编辑' },
    { keys: '/settings', desc: '设置' },
  ]},
]

export function ShortcutHelp({ onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    window.addEventListener('mousedown', handler)
    return () => window.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div ref={ref} className="w-[480px] max-h-[80vh] overflow-y-auto rounded-xl border border-border-default bg-surface-elevated shadow-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-border-subtle bg-surface-elevated px-5 py-3">
          <h2 className="text-sm font-medium text-content-secondary">键盘快捷键</h2>
          <button onClick={onClose} className="rounded p-1 text-content-subtle hover:bg-surface-overlay hover:text-content-heading">Esc</button>
        </div>

        <div className="p-5 space-y-5">
          {SHORTCUTS.map((group) => (
            <div key={group.category}>
              <h3 className="mb-2 text-[10px] font-medium uppercase tracking-wider text-content-subtle">{group.category}</h3>
              <div className="space-y-1">
                {group.items.map((item) => (
                  <div key={item.keys} className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-surface-overlay/50">
                    <span className="text-xs text-content-muted">{item.desc}</span>
                    <kbd className="rounded border border-border-default bg-surface-overlay px-2 py-0.5 font-mono text-[10px] text-content-heading">{item.keys}</kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-border-subtle px-5 py-3 text-center text-[10px] text-content-subtle">
          按 Esc 关闭
        </div>
      </div>
    </div>
  )
}
