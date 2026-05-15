import { useState } from 'react'
import type { AgentNodeData } from './types'

interface AgentEditPanelProps {
  data: AgentNodeData
  onSave: (data: AgentNodeData) => void
  onClose: () => void
}

const AVAILABLE_TOOLS = ['web', 'browse', 'code', 'file', 'shell', 'image_gen', 'vision', 'memory', 'delegation', 'skills']
const AVAILABLE_MODELS = ['gpt-4', 'gpt-4o', 'gpt-3.5-turbo', 'claude-3.5-sonnet', 'claude-3-opus', 'local']
const STATUS_OPTIONS: { value: AgentNodeData['status']; label: string }[] = [
  { value: 'idle', label: '空闲' },
  { value: 'running', label: '运行中' },
  { value: 'error', label: '错误' },
  { value: 'success', label: '成功' }
]

export function AgentEditPanel({ data, onSave, onClose }: AgentEditPanelProps) {
  const [form, setForm] = useState<AgentNodeData>({ ...data })

  const toggleTool = (tool: string) => {
    setForm((f) => ({
      ...f,
      tools: f.tools.includes(tool) ? f.tools.filter((t) => t !== tool) : [...f.tools, tool]
    }))
  }

  return (
    <div className="fixed right-0 top-0 z-50 flex h-full w-72 flex-col border-l border-border-default bg-surface-elevated shadow-2xl">
      <header className="flex items-center justify-between border-b border-border-default px-4 py-3">
        <h3 className="text-sm font-medium text-content-heading">编辑 Agent</h3>
        <button onClick={onClose} className="rounded p-1 text-xs text-content-subtle hover:bg-surface-overlay hover:text-content-heading">
          ✕
        </button>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <div>
          <label className="mb-1 block text-xs text-content-subtle">名称</label>
          <input
            type="text"
            value={form.label as string}
            onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
            className="w-full rounded border border-border-default bg-surface-overlay px-3 py-1.5 text-sm text-content-secondary outline-none transition-colors focus:border-accent"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs text-content-subtle">角色</label>
          <input
            type="text"
            value={form.role as string}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
            className="w-full rounded border border-border-default bg-surface-overlay px-3 py-1.5 text-sm text-content-secondary outline-none transition-colors focus:border-accent"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs text-content-subtle">模型</label>
          <select
            value={form.model as string}
            onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
            className="w-full rounded border border-border-default bg-surface-overlay px-3 py-1.5 text-sm text-content-secondary"
          >
            {AVAILABLE_MODELS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs text-content-subtle">状态</label>
          <div className="flex gap-1">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setForm((f) => ({ ...f, status: opt.value }))}
                className={`rounded px-2 py-1 text-xs transition-colors ${
                  form.status === opt.value
                    ? 'bg-accent text-white'
                    : 'bg-surface-overlay text-content-subtle hover:text-content-heading'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs text-content-subtle">颜色</label>
          <div className="flex gap-1.5">
            {['#6366f1', '#8b5cf6', '#a78bfa', '#f59e0b', '#10b981', '#ec4899', '#3b82f6', '#ef4444'].map((c) => (
              <button
                key={c}
                onClick={() => setForm((f) => ({ ...f, color: c }))}
                className={`h-6 w-6 rounded-full border-2 transition-transform ${
                  form.color === c ? 'scale-110 border-white' : 'border-transparent'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs text-content-subtle">工具</label>
          <div className="flex flex-wrap gap-1">
            {AVAILABLE_TOOLS.map((tool) => (
              <button
                key={tool}
                onClick={() => toggleTool(tool)}
                className={`rounded px-2 py-1 text-xs transition-colors ${
                  form.tools.includes(tool)
                    ? 'bg-accent/20 text-accent-text'
                    : 'bg-surface-overlay text-content-subtle hover:text-content-muted'
                }`}
              >
                {tool}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-border-default p-3">
        <button
          onClick={() => { onSave(form); onClose() }}
          className="w-full rounded-lg bg-accent py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
        >
          保存
        </button>
      </div>
    </div>
  )
}
