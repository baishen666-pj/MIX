import { useState } from 'react'

interface ToolItem {
  id: string
  key: string
  name: string
  description: string
  category: 'search' | 'creation' | 'execution' | 'system'
  enabled: boolean
  icon: string
}

const DEFAULT_TOOLS: ToolItem[] = [
  { id: 't1', key: 'web', name: '网页搜索', description: '搜索互联网获取实时信息', category: 'search', enabled: true, icon: '🔍' },
  { id: 't2', key: 'browse', name: '浏览器', description: '浏览网页、提取内容、截图', category: 'search', enabled: true, icon: '🌐' },
  { id: 't3', key: 'code', name: '代码执行', description: '执行代码并返回结果', category: 'execution', enabled: true, icon: '💻' },
  { id: 't4', key: 'file', name: '文件系统', description: '读取、写入、搜索文件', category: 'system', enabled: true, icon: '📁' },
  { id: 't5', key: 'shell', name: '终端', description: '执行 Shell 命令', category: 'execution', enabled: true, icon: '⚡' },
  { id: 't6', key: 'image_gen', name: '图片生成', description: '生成图片（DALL-E / Stable Diffusion）', category: 'creation', enabled: false, icon: '🎨' },
  { id: 't7', key: 'vision', name: '视觉分析', description: '分析图片内容', category: 'creation', enabled: false, icon: '👁️' },
  { id: 't8', key: 'tts', name: '语音合成', description: '文字转语音', category: 'creation', enabled: false, icon: '🔊' },
  { id: 't9', key: 'memory', name: '记忆系统', description: '长期记忆存取', category: 'system', enabled: true, icon: '🧠' },
  { id: 't10', key: 'delegation', name: '任务委派', description: '委派任务给子 Agent', category: 'system', enabled: true, icon: '🤝' },
  { id: 't11', key: 'skills', name: '技能插件', description: '技能插件系统', category: 'system', enabled: true, icon: '📦' },
  { id: 't12', key: 'cronjob', name: '定时任务', description: '定时任务调度', category: 'system', enabled: false, icon: '⏰' }
]

const CATEGORIES: Record<string, { label: string; color: string }> = {
  search: { label: '搜索', color: 'border-l-blue-500' },
  creation: { label: '创作', color: 'border-l-purple-500' },
  execution: { label: '执行', color: 'border-l-success' },
  system: { label: '系统', color: 'border-l-warning' }
}

export function ToolsPanel() {
  const [tools, setTools] = useState<ToolItem[]>(DEFAULT_TOOLS)
  const [filter, setFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  const toggleTool = (id: string) => {
    setTools((prev) =>
      prev.map((t) => (t.id === id ? { ...t, enabled: !t.enabled } : t))
    )
  }

  const enableAll = () => setTools((prev) => prev.map((t) => ({ ...t, enabled: true })))
  const disableAll = () => setTools((prev) => prev.map((t) => ({ ...t, enabled: false })))

  const filtered = tools.filter((t) => {
    if (categoryFilter !== 'all' && t.category !== categoryFilter) return false
    if (filter) {
      const q = filter.toLowerCase()
      return t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) || t.key.toLowerCase().includes(q)
    }
    return true
  })

  const enabledCount = tools.filter((t) => t.enabled).length

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-border-subtle px-4 py-2">
        <h2 className="text-sm font-medium text-content-heading">工具集</h2>
        <div className="flex gap-1">
          <button onClick={enableAll} className="rounded px-2 py-1 text-xs text-content-subtle hover:bg-surface-overlay hover:text-content-heading">
            全部启用
          </button>
          <button onClick={disableAll} className="rounded px-2 py-1 text-xs text-content-subtle hover:bg-surface-overlay hover:text-content-heading">
            全部禁用
          </button>
        </div>
      </header>

      <div className="flex items-center gap-2 border-b border-border-subtle px-4 py-2">
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="搜索工具..."
          className="flex-1 rounded border border-border-default bg-surface-elevated px-3 py-1.5 text-sm text-content-secondary placeholder-content-subtle outline-none focus:border-accent"
        />
        <div className="flex gap-1">
          {Object.entries(CATEGORIES).map(([key, cfg]) => (
            <button
              key={key}
              onClick={() => setCategoryFilter(categoryFilter === key ? 'all' : key)}
              className={`rounded px-2 py-1 text-xs transition-colors ${
                categoryFilter === key
                  ? 'bg-accent/20 text-accent-text'
                  : 'text-content-subtle hover:bg-surface-overlay hover:text-content-muted'
              }`}
            >
              {cfg.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
          {filtered.map((tool) => {
            const cat = CATEGORIES[tool.category]
            return (
              <div
                key={tool.id}
                className={`rounded-lg border-l-2 ${cat.color} border border-border-subtle bg-surface-elevated p-3 transition-colors ${
                  tool.enabled ? 'opacity-100' : 'opacity-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{tool.icon}</span>
                    <div>
                      <div className="text-sm font-medium text-content-heading">{tool.name}</div>
                      <div className="text-xs text-content-subtle">{tool.description}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleTool(tool.id)}
                    className={`relative h-5 w-9 rounded-full transition-colors ${
                      tool.enabled ? 'bg-accent' : 'bg-surface-inset'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                        tool.enabled ? 'left-[18px]' : 'left-0.5'
                      }`}
                    />
                  </button>
                </div>
                <div className="mt-2 text-[10px] text-content-subtle">
                  key: {tool.key} · {cat.label}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="border-t border-border-subtle px-4 py-2">
        <p className="text-xs text-content-subtle">
          已启用 {enabledCount}/{tools.length} 个工具 — 切换即时生效
        </p>
      </div>
    </div>
  )
}
