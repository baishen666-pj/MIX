import { CATEGORY_LABELS } from '../lib/approvalDetection'

export function ChatApprovalBar({ summary, confidence, category, onApprove, onReject }: {
  summary: string
  confidence: 'high' | 'medium'
  category: string
  onApprove: () => void
  onReject: () => void
}) {
  const categoryLabel = CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS] || category
  return (
    <div className="border-t border-warning/30 bg-warning-bg/30 px-4 py-2.5">
      <div className="flex items-center gap-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-warning/20">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-warning">
            <path d="M12 9v4m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${confidence === 'high' ? 'bg-danger/15 text-danger' : 'bg-warning/15 text-warning'}`}>
              {confidence === 'high' ? '高风险' : '中风险'}
            </span>
            <span className="text-[10px] text-content-subtle">{categoryLabel}</span>
          </div>
          <p className="mt-0.5 text-xs text-content-secondary truncate">{summary}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={onReject}
            className="rounded-lg border border-border-default bg-surface-elevated px-3 py-1.5 text-xs font-medium text-content-muted transition-colors hover:bg-surface-inset"
          >
            拒绝
          </button>
          <button
            onClick={onApprove}
            className="rounded-lg bg-success px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-success/80"
          >
            批准执行
          </button>
        </div>
      </div>
    </div>
  )
}
