interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  onConfirm: (() => void) | null
  onCancel: () => void
}

export function ConfirmDialog({ open, title, message, onConfirm, onCancel }: ConfirmDialogProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-[360px] rounded-xl border border-border-default bg-surface-elevated shadow-2xl">
        <div className="px-4 pt-4 pb-2">
          <h3 className="text-sm font-medium text-content-heading">{title}</h3>
          <p className="mt-2 text-xs text-content-secondary">{message}</p>
        </div>

        <div className="flex justify-end gap-2 border-t border-border-subtle px-4 py-3">
          <button
            onClick={onCancel}
            className="rounded-lg px-4 py-1.5 text-xs text-content-subtle hover:bg-surface-overlay hover:text-content-heading"
          >
            取消
          </button>
          <button
            onClick={onConfirm ?? undefined}
            className="rounded-lg bg-danger px-4 py-1.5 text-xs font-medium text-white transition-colors hover:opacity-90"
          >
            确定
          </button>
        </div>
      </div>
    </div>
  )
}
