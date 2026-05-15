import { useState, useEffect, useRef, useMemo } from 'react'

interface SlashCommand {
  key: string
  label: string
  description: string
  category: 'chat' | 'agent' | 'tools' | 'info'
}

const COMMANDS: SlashCommand[] = [
  { key: 'new', label: '/new', description: '新建对话', category: 'chat' },
  { key: 'clear', label: '/clear', description: '清空当前对话', category: 'chat' },
  { key: 'help', label: '/help', description: '显示帮助', category: 'info' },
  { key: 'model', label: '/model', description: '查看/切换模型', category: 'info' },
  { key: 'canvas', label: '/canvas', description: '切换到 Agent 画布', category: 'agent' },
  { key: 'memory', label: '/memory', description: '查看记忆', category: 'info' },
  { key: 'tools', label: '/tools', description: '查看工具集', category: 'info' },
  { key: 'schedule', label: '/schedule', description: '定时任务管理', category: 'tools' },
  { key: 'workflow', label: '/workflow', description: '工作流引擎', category: 'agent' },
  { key: 'checkpoint', label: '/checkpoint', description: '检查点管理', category: 'tools' },
  { key: 'soul', label: '/soul', description: '编辑角色 (SOUL)', category: 'info' },
  { key: 'settings', label: '/settings', description: '打开设置', category: 'info' },
  { key: 'reset', label: '/reset', description: '重置会话', category: 'agent' },
  { key: 'compact', label: '/compact', description: '压缩上下文', category: 'agent' },
  { key: 'usage', label: '/usage', description: '查看 token 用量', category: 'info' },
  { key: 'web', label: '/web', description: '搜索网页', category: 'tools' },
  { key: 'image', label: '/image', description: '生成图片', category: 'tools' },
  { key: 'code', label: '/code', description: '执行代码', category: 'tools' },
  { key: 'approve', label: '/approve', description: '发送测试审批请求到老板', category: 'agent' }
]

interface SlashCommandMenuProps {
  filter: string
  onSelect: (command: SlashCommand) => void
  onClose: () => void
  position: { top: number; left: number }
}

export type { SlashCommand }

export function SlashCommandMenu({ filter, onSelect, onClose, position }: SlashCommandMenuProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const menuRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  const filtered = useMemo(() => {
    if (!filter) return COMMANDS
    const q = filter.toLowerCase()
    return COMMANDS.filter(
      (c) => c.label.toLowerCase().includes(q) || c.description.toLowerCase().includes(q)
    )
  }, [filter])

  useEffect(() => {
    setSelectedIndex(0)
  }, [filter])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((i) => (i + 1) % filtered.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((i) => (i - 1 + filtered.length) % filtered.length)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (filtered[selectedIndex]) onSelect(filtered[selectedIndex])
      } else if (e.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [filtered, selectedIndex, onSelect, onClose])

  useEffect(() => {
    itemRefs.current[selectedIndex]?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  if (filtered.length === 0) return null

  return (
    <div
      ref={menuRef}
      className="fixed z-50 w-72 overflow-hidden rounded-lg border border-border-default bg-surface-elevated shadow-xl"
      style={{ top: position.top, left: position.left }}
    >
      <div className="max-h-64 overflow-y-auto py-1">
        {filtered.map((cmd, i) => (
          <button
            key={cmd.key}
            ref={(el) => { itemRefs.current[i] = el }}
            onClick={() => onSelect(cmd)}
            className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors ${
              i === selectedIndex ? 'bg-accent/20 text-accent-text' : 'text-content-muted hover:bg-surface-overlay'
            }`}
          >
            <span className="font-mono text-xs text-content-subtle">{cmd.label}</span>
            <span className="text-xs">{cmd.description}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export { COMMANDS }
