import { useState, useRef, useCallback } from 'react'
import { useAppStore } from '../../stores/app'
import { AGENT_CONFIG_SYSTEM_PROMPT, parseAgentConfigResponse } from '../../lib/agentConfigPrompt'
import type { FlowTemplate } from './types'

interface AIConfigDialogProps {
  open: boolean
  onClose: () => void
  onApply: (template: FlowTemplate) => void
}

const EXAMPLE_PROMPTS = [
  '搭建一个代码审查团队，包含研究员、审查员和修复者',
  '帮我设计一个内容创作流水线，从选题到发布',
  '构建一个数据分析团队，能自动采集、清洗、分析和可视化',
  '设计一个客户服务系统，包含分类、处理和质检环节'
]

export function AIConfigDialog({ open, onClose, onApply }: AIConfigDialogProps) {
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<FlowTemplate | null>(null)
  const [error, setError] = useState<string | null>(null)
  const bufferRef = useRef('')
  const setAiConfigMode = useAppStore((s) => s.setAiConfigMode)

  const handleGenerate = useCallback(() => {
    if (!description.trim() || !window.mixDesktop) return

    setLoading(true)
    setError(null)
    setPreview(null)
    bufferRef.current = ''
    setAiConfigMode(true)

    const messages = [
      { role: 'system', content: AGENT_CONFIG_SYSTEM_PROMPT },
      { role: 'user', content: description.trim() }
    ]

    const unsubChunk = window.mixDesktop.onChatChunk((chunk: string) => {
      bufferRef.current += chunk
    })

    const unsubDone = window.mixDesktop.onChatDone(() => {
      unsubChunk()
      unsubDone()
      unsubError()
      setAiConfigMode(false)
      setLoading(false)

      const result = parseAgentConfigResponse(bufferRef.current)
      if (result) {
        setPreview(result)
      } else {
        setError('AI 返回的配置格式无法解析，请重试或修改描述')
      }
    })

    const unsubError = window.mixDesktop.onChatError((msg: string) => {
      unsubChunk()
      unsubDone()
      unsubError()
      setAiConfigMode(false)
      setLoading(false)
      setError(`生成失败: ${msg}`)
    })

    window.mixDesktop.chatSend({ messages }).catch(() => {
      unsubChunk()
      unsubDone()
      unsubError()
      setAiConfigMode(false)
      setLoading(false)
      setError('请求发送失败')
    })
  }, [description, setAiConfigMode])

  const handleApply = useCallback(() => {
    if (preview) {
      onApply(preview)
      onClose()
      setDescription('')
      setPreview(null)
      setError(null)
    }
  }, [preview, onApply, onClose])

  const handleRetry = useCallback(() => {
    setPreview(null)
    setError(null)
    setLoading(false)
  }, [])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="mx-4 w-full max-w-xl rounded-xl border border-border-default bg-surface-elevated shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2L9 12l-7 1 5 5-1 7 6-3 6 3-1-7 5-5-7-1z"/></svg>
            <h3 className="text-sm font-medium text-content-heading">AI 智能配置</h3>
          </div>
          <button onClick={onClose} className="rounded p-1 text-content-subtle hover:bg-surface-overlay hover:text-content-heading">✕</button>
        </div>

        <div className="p-4">
          {!preview && !loading && !error && (
            <>
              <p className="mb-3 text-xs text-content-muted">描述你想要的 Agent 团队或工作流，AI 将自动设计最佳配置方案。</p>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="例：搭建一个代码审查团队..."
                rows={3}
                className="w-full rounded-lg border border-border-default bg-surface-overlay px-3 py-2 text-sm text-content-heading placeholder-content-subtle outline-none focus:border-accent resize-none"
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleGenerate() }}
              />
              <div className="mt-2 flex flex-wrap gap-1">
                {EXAMPLE_PROMPTS.map((p) => (
                  <button
                    key={p.slice(0, 10)}
                    onClick={() => setDescription(p)}
                    className="rounded-md border border-border-subtle px-2 py-1 text-[10px] text-content-subtle transition-colors hover:border-border-default hover:text-content-muted"
                  >
                    {p.length > 18 ? p.slice(0, 18) + '...' : p}
                  </button>
                ))}
              </div>
            </>
          )}

          {loading && (
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              <p className="text-sm text-content-muted">AI 正在设计配置方案...</p>
              <p className="text-xs text-content-subtle">分析需求 → 设计角色 → 分配工具 → 规划连接</p>
            </div>
          )}

          {error && (
            <div className="py-4 text-center">
              <p className="text-sm text-danger">{error}</p>
              <div className="mt-3 flex justify-center gap-2">
                <button onClick={handleRetry} className="rounded-lg bg-accent px-4 py-1.5 text-xs font-medium text-white hover:bg-accent-hover">重试</button>
                <button onClick={() => { setDescription(''); setError(null) }} className="rounded-lg border border-border-default px-4 py-1.5 text-xs text-content-muted hover:bg-surface-overlay">重新描述</button>
              </div>
            </div>
          )}

          {preview && (
            <div>
              <div className="mb-3 flex items-center gap-2">
                <span className="text-sm font-medium text-content-heading">{preview.name}</span>
                {preview.description && <span className="text-xs text-content-subtle">— {preview.description}</span>}
              </div>
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {preview.nodes.map((node, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-lg border border-border-subtle bg-surface-overlay p-2.5">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white" style={{ backgroundColor: node.data.color }}>
                      {(node.data.label as string).charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium text-content-heading">{node.data.label as string}</div>
                      <div className="truncate text-[10px] text-content-subtle">{node.data.role as string}</div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-[10px] text-content-muted">{node.data.model as string}</div>
                      {((node.data.tools as string[]) || []).length > 0 && (
                        <div className="text-[9px] text-content-subtle">{(node.data.tools as string[]).join(', ')}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {preview.edges.length > 0 && (
                <div className="mt-2 text-center text-[10px] text-content-subtle">
                  {preview.edges.length} 条连接
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-border-subtle px-4 py-3">
          {!preview && !loading && !error && (
            <>
              <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-xs text-content-subtle hover:bg-surface-overlay">取消</button>
              <button
                onClick={handleGenerate}
                disabled={!description.trim()}
                className="rounded-lg bg-accent px-4 py-1.5 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-40"
              >
                生成配置 (Ctrl+Enter)
              </button>
            </>
          )}
          {preview && (
            <>
              <button onClick={handleRetry} className="rounded-lg px-3 py-1.5 text-xs text-content-subtle hover:bg-surface-overlay">重新生成</button>
              <button onClick={handleApply} className="rounded-lg bg-accent px-4 py-1.5 text-xs font-medium text-white hover:bg-accent-hover">
                应用到画布 ({preview.nodes.length} 个 Agent)
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
