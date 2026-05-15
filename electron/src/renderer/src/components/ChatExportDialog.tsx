import type { ChatMessage } from '../../../shared/types'
import { getExportContent, getExportFileName, type ExportFormat } from '../lib/export'

export function ChatExportDialog({ messages, sessionId, format, onFormatChange, onExport, onClose }: {
  messages: ChatMessage[]
  sessionId: string | null
  format: ExportFormat
  onFormatChange: (f: ExportFormat) => void
  onExport: () => void
  onClose: () => void
}) {
  const title = sessionId ? `对话 ${new Date().toLocaleDateString('zh-CN')}` : 'AI GUI 对话'
  const preview = getExportContent(messages.slice(0, 3), title, format)

  const formats: { value: ExportFormat; label: string; desc: string }[] = [
    { value: 'markdown', label: 'Markdown', desc: '带格式的 .md 文件，适合阅读和博客' },
    { value: 'json', label: 'JSON', desc: '结构化数据，适合程序处理和备份' },
    { value: 'txt', label: '纯文本', desc: '简单文本格式，兼容性最好' }
  ]

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-[460px] rounded-xl border border-border-default bg-surface-elevated shadow-2xl">
        <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
          <h3 className="text-sm font-medium text-content-secondary">导出对话</h3>
          <button onClick={onClose} className="rounded p-1 text-content-subtle hover:text-content-heading">✕</button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="mb-2 block text-[10px] font-medium uppercase tracking-wider text-content-subtle">导出格式</label>
            <div className="grid grid-cols-3 gap-2">
              {formats.map((f) => (
                <button
                  key={f.value}
                  onClick={() => onFormatChange(f.value)}
                  className={`rounded-lg border p-2.5 text-left transition-colors ${
                    format === f.value
                      ? 'border-accent bg-accent/10'
                      : 'border-border-default hover:border-border-default'
                  }`}
                >
                  <div className={`text-xs font-medium ${format === f.value ? 'text-accent-text' : 'text-content-muted'}`}>{f.label}</div>
                  <div className="mt-1 text-[10px] text-content-subtle">{f.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-[10px] font-medium uppercase tracking-wider text-content-subtle">预览</label>
            <pre className="max-h-32 overflow-y-auto rounded-lg border border-border-subtle bg-surface-base p-3 text-[10px] leading-relaxed text-content-subtle whitespace-pre-wrap">
              {preview.slice(0, 500)}{preview.length > 500 ? '\n...' : ''}
            </pre>
          </div>

          <div className="flex items-center justify-between text-[10px] text-content-subtle">
            <span>共 {messages.length} 条消息</span>
            <span>{getExportFileName(title, format)}</span>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-border-subtle px-4 py-3">
          <button onClick={onClose} className="rounded-lg px-4 py-1.5 text-xs text-content-subtle hover:bg-surface-overlay hover:text-content-heading">取消</button>
          <button onClick={onExport} className="rounded-lg bg-accent px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-hover">
            保存文件
          </button>
        </div>
      </div>
    </div>
  )
}
