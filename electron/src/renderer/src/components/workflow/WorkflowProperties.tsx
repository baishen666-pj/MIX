import { useState, useEffect } from 'react'
import type { WorkflowNode } from '../../../../shared/types'

interface Props {
  node: WorkflowNode
  onSave: (data: WorkflowNode['data']) => void
  onClose: () => void
  onDelete: () => void
}

export function WorkflowProperties({ node, onSave, onClose, onDelete }: Props) {
  const [label, setLabel] = useState(node.data.label)
  const [prompt, setPrompt] = useState(node.data.prompt || '')
  const [model, setModel] = useState(node.data.model || '')
  const [systemPrompt, setSystemPrompt] = useState(node.data.systemPrompt || '')
  const [condition, setCondition] = useState(node.data.condition || '')

  useEffect(() => {
    setLabel(node.data.label)
    setPrompt(node.data.prompt || '')
    setModel(node.data.model || '')
    setSystemPrompt(node.data.systemPrompt || '')
    setCondition(node.data.condition || '')
  }, [node.id, node.data])

  const handleSave = () => {
    const data: WorkflowNode['data'] = { label }
    if (node.type === 'agent') {
      data.prompt = prompt
      data.model = model
      data.systemPrompt = systemPrompt
    }
    if (node.type === 'condition') {
      data.condition = condition
    }
    onSave(data)
  }

  return (
    <div className="absolute right-0 top-0 z-10 h-full w-72 border-l border-border-subtle bg-surface-base/95 backdrop-blur-sm overflow-y-auto">
      <div className="flex items-center justify-between border-b border-border-subtle px-3 py-2">
        <h3 className="text-xs font-medium text-content-heading">节点属性</h3>
        <div className="flex gap-1">
          <button onClick={onDelete} className="rounded p-1 text-[10px] text-content-subtle hover:text-danger" title="删除节点">✕</button>
          <button onClick={onClose} className="rounded p-1 text-[10px] text-content-subtle hover:text-content-heading" title="关闭">✕</button>
        </div>
      </div>

      <div className="p-3 space-y-3">
        <div>
          <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-content-subtle">名称</label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="w-full rounded border border-border-default bg-surface-overlay px-2 py-1.5 text-xs text-content-secondary outline-none focus:border-accent"
          />
        </div>

        <div>
          <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-content-subtle">类型</label>
          <div className="rounded border border-border-subtle bg-surface-elevated px-2 py-1.5 text-xs text-content-subtle">
            {node.type === 'start' ? '开始节点' : node.type === 'end' ? '结束节点' : node.type === 'condition' ? '条件判断' : 'Agent 节点'}
          </div>
        </div>

        {node.type === 'agent' && (
          <>
            <div>
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-content-subtle">系统提示词</label>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="该 Agent 的系统角色设定..."
                rows={3}
                className="w-full rounded border border-border-default bg-surface-overlay px-2 py-1.5 text-xs text-content-secondary placeholder-content-subtle outline-none focus:border-accent resize-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-content-subtle">用户提示词</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="发送给 AI 的消息内容，可使用 {{input}} 引用上游输出..."
                rows={4}
                className="w-full rounded border border-border-default bg-surface-overlay px-2 py-1.5 text-xs text-content-secondary placeholder-content-subtle outline-none focus:border-accent resize-none"
              />
              <div className="mt-1 space-y-0.5">
                <p className="text-[10px] text-content-subtle">{'{{input}}'} 上游输出 · {'{{$nodeId}}'} 指定节点 · {'{{summary}}'} 全局摘要</p>
                <p className="text-[10px] text-content-subtle">{'{{context}}'} 完整 JSON · {'{{node:id.label}}'} 节点元数据</p>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-content-subtle">模型</label>
              <input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="留空使用默认模型"
                className="w-full rounded border border-border-default bg-surface-overlay px-2 py-1.5 text-xs text-content-secondary placeholder-content-subtle outline-none focus:border-accent"
              />
            </div>
          </>
        )}

        {node.type === 'condition' && (
          <div>
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-content-subtle">条件表达式</label>
            <textarea
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              placeholder="例：output.length > 100&#10;例：output.includes('错误')&#10;评估上一节点的输出内容"
              rows={3}
              className="w-full rounded border border-border-default bg-surface-overlay px-2 py-1.5 text-xs text-content-secondary placeholder-content-subtle outline-none focus:border-accent resize-none"
            />
            <p className="mt-1 text-[10px] text-content-subtle">条件为真走"是"分支，否则走"否"分支</p>
            <div className="mt-2 rounded-lg border border-warning/30 bg-warning-bg/20 px-2.5 py-2">
              <p className="text-[10px] font-medium text-warning">人工审批模式</p>
              <p className="mt-0.5 text-[10px] text-content-muted">
                将名称改为「审批」/「确认」/「人工审批」，或留空条件表达式，即可触发人工审批弹窗。
              </p>
            </div>
          </div>
        )}

        <button
          onClick={handleSave}
          className="w-full rounded-lg bg-accent py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-hover"
        >
          保存
        </button>
      </div>
    </div>
  )
}
