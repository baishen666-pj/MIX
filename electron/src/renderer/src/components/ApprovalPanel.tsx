import { useEffect } from 'react'
import { useAppStore } from '../stores/app'

export function ApprovalPanel() {
  const approvalRequests = useAppStore((s) => s.approvalRequests)
  const respondApproval = useAppStore((s) => s.respondApproval)
  const pendingRequests = approvalRequests.filter((r) => r.status === 'pending')

  // Keyboard shortcuts: Enter=approve, Escape=reject
  useEffect(() => {
    if (pendingRequests.length === 0) return
    const req = pendingRequests[0]
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter') { e.preventDefault(); respondApproval(req.id, true) }
      if (e.key === 'Escape') { e.preventDefault(); respondApproval(req.id, false) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [pendingRequests, respondApproval])

  if (pendingRequests.length === 0) return null

  const req = pendingRequests[0]

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center pb-6 pointer-events-none">
      <div className="pointer-events-auto w-full max-w-md animate-slide-up rounded-xl border border-warning/40 bg-surface-elevated shadow-2xl shadow-warning/10">
        <div className="flex items-center gap-2 border-b border-border-subtle px-4 py-2.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-warning-bg">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-warning">
              <path d="M12 9v4m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
            </svg>
          </div>
          <div className="flex-1">
            <span className="text-xs font-medium text-warning">需要你的审批</span>
          </div>
          <span className="text-[10px] text-content-subtle">
            {new Date(req.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        <div className="px-4 py-3">
          <div className="flex items-start gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/20 text-xs font-bold text-accent-text">
              {req.fromMemberName.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium text-content-heading">{req.fromMemberName}</span>
                <span className="rounded bg-surface-overlay px-1.5 py-0.5 text-[10px] text-content-subtle">{req.fromProjectName}</span>
              </div>
              <p className="mt-0.5 text-xs font-medium text-content-secondary">{req.title}</p>
              {req.description && (
                <p className="mt-1 text-xs text-content-muted">{req.description}</p>
              )}
              {req.context && (
                <div className="mt-2 rounded-lg bg-surface-overlay p-2 text-[10px] text-content-subtle max-h-20 overflow-y-auto">
                  {req.context}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-2 border-t border-border-subtle px-4 py-3">
          <button
            onClick={() => respondApproval(req.id, false)}
            className="flex-1 rounded-lg border border-border-default bg-surface-overlay px-3 py-2 text-xs font-medium text-content-muted transition-colors hover:bg-surface-inset"
          >
            拒绝
          </button>
          <button
            onClick={() => respondApproval(req.id, true)}
            className="flex-1 rounded-lg bg-success px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-success/80"
          >
            批准
          </button>
        </div>

        {pendingRequests.length > 1 && (
          <div className="border-t border-border-subtle px-4 py-1.5 text-center text-[10px] text-content-subtle">
            还有 {pendingRequests.length - 1} 个待审批
          </div>
        )}
      </div>
    </div>
  )
}
