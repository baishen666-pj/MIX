import { useState, useEffect, useCallback } from 'react'
import { useComputerUseStore } from '../../stores/computerUseStore'

export function ComputerUsePanel() {
  const isRunning = useComputerUseStore((s) => s.isRunning)
  const safetyMode = useComputerUseStore((s) => s.safetyMode)
  const actionCount = useComputerUseStore((s) => s.actionCount)
  const lastScreenshot = useComputerUseStore((s) => s.lastScreenshot)
  const emergencyStopped = useComputerUseStore((s) => s.emergencyStopped)
  const screenSize = useComputerUseStore((s) => s.screenSize)
  const setRunning = useComputerUseStore((s) => s.setRunning)
  const setSafetyMode = useComputerUseStore((s) => s.setSafetyMode)
  const setLastScreenshot = useComputerUseStore((s) => s.setLastScreenshot)
  const setEmergencyStopped = useComputerUseStore((s) => s.setEmergencyStopped)
  const setScreenSize = useComputerUseStore((s) => s.setScreenSize)
  const reset = useComputerUseStore((s) => s.reset)

  const [starting, setStarting] = useState(false)
  const [confirmAction, setConfirmAction] = useState<{ method: string; params: Record<string, unknown> } | null>(null)

  useEffect(() => {
    if (!window.mixDesktop) return

    const unsubConfirm = window.mixDesktop.onCuConfirmRequest((action: { method: string; params: Record<string, unknown> }) => {
      setConfirmAction(action)
    })

    const unsubEmergency = window.mixDesktop.onCuEmergencyStop(() => {
      setEmergencyStopped(true)
      setRunning(false)
    })

    return () => {
      unsubConfirm()
      unsubEmergency()
    }
  }, [setEmergencyStopped, setRunning])

  const handleStart = useCallback(async () => {
    if (!window.mixDesktop) return
    setStarting(true)
    try {
      const ok = await window.mixDesktop.cuStart()
      if (ok) {
        setRunning(true)
        const status = await window.mixDesktop.cuStatus()
        if (status.screenSize) setScreenSize(status.screenSize)
      }
    } finally {
      setStarting(false)
    }
  }, [setRunning, setScreenSize])

  const handleStop = useCallback(async () => {
    if (!window.mixDesktop) return
    await window.mixDesktop.cuStop()
    reset()
  }, [reset])

  const handleScreenshot = useCallback(async () => {
    if (!window.mixDesktop) return
    const res = await window.mixDesktop.cuScreenshot()
    if (res.ok && res.data) {
      const d = res.data as { base64: string }
      setLastScreenshot(d.base64)
    }
  }, [setLastScreenshot])

  const handleConfirmResponse = useCallback(async (approved: boolean) => {
    setConfirmAction(null)
    // The main process is waiting for cu-confirm-response via ipcMain.on
    // We need to use ipcRenderer.send directly — expose a helper in preload
    if (window.mixDesktop) {
      window.mixDesktop.cuConfirmRespond(approved)
    }
  }, [])

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-border-subtle px-4 py-2">
        <h2 className="text-sm font-medium text-content-heading">Computer Use</h2>
        <div className="flex items-center gap-2">
          {isRunning ? (
            <button
              onClick={handleStop}
              className="rounded bg-danger px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-danger/80"
            >
              停止
            </button>
          ) : (
            <button
              onClick={handleStart}
              disabled={starting || emergencyStopped}
              className="rounded bg-accent px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
            >
              {starting ? '启动中...' : emergencyStopped ? '已紧急停止' : '启动'}
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-lg space-y-4">

          {/* Status */}
          <section className="rounded-lg border border-border-subtle bg-surface-elevated p-4">
            <div className="flex items-center gap-3">
              <span className={`h-3 w-3 rounded-full ${isRunning ? 'bg-success animate-pulse' : emergencyStopped ? 'bg-danger' : 'bg-content-subtle'}`} />
              <div>
                <div className="text-sm font-medium text-content-heading">
                  {isRunning ? '运行中' : emergencyStopped ? '紧急停止' : '未启动'}
                </div>
                {screenSize && <div className="text-[10px] text-content-subtle">屏幕: {screenSize.width}x{screenSize.height}</div>}
              </div>
              <div className="ml-auto text-xs text-content-subtle">操作次数: {actionCount}</div>
            </div>
          </section>

          {/* Safety Mode */}
          <section className="rounded-lg border border-border-subtle bg-surface-elevated p-4">
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-content-subtle">安全模式</h3>
            <div className="flex gap-2">
              {([
                { mode: 'confirm' as const, label: '确认模式', desc: '每个操作需用户确认' },
                { mode: 'autonomous' as const, label: '自动模式', desc: 'AI 自动执行操作' }
              ]).map(({ mode, label, desc }) => (
                <button
                  key={mode}
                  onClick={async () => {
                    if (!window.mixDesktop) return
                    await window.mixDesktop.cuSetSafety(mode)
                    setSafetyMode(mode)
                  }}
                  className={`flex flex-1 flex-col items-center gap-1 rounded-lg border px-3 py-2 transition-colors ${
                    safetyMode === mode
                      ? mode === 'confirm'
                        ? 'border-success/50 bg-success/10'
                        : 'border-warning/50 bg-warning/10'
                      : 'border-border-default hover:bg-surface-overlay'
                  }`}
                >
                  <span className="text-xs font-medium text-content-heading">{label}</span>
                  <span className="text-[10px] text-content-subtle">{desc}</span>
                </button>
              ))}
            </div>
            <div className="mt-2 rounded bg-warning/10 px-3 py-2 text-[10px] text-content-subtle">
              Ctrl+Shift+Esc 紧急停止所有操作
            </div>
          </section>

          {/* Screenshot Preview */}
          <section className="rounded-lg border border-border-subtle bg-surface-elevated p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-medium uppercase tracking-wider text-content-subtle">屏幕截图</h3>
              <button
                onClick={handleScreenshot}
                disabled={!isRunning}
                className="rounded border border-border-default bg-surface-overlay px-2 py-1 text-[10px] text-content-subtle transition-colors hover:bg-surface-inset hover:text-content-heading disabled:opacity-50"
              >
                截取屏幕
              </button>
            </div>
            {lastScreenshot ? (
              <div className="mt-2 overflow-hidden rounded border border-border-subtle">
                <img
                  src={`data:image/png;base64,${lastScreenshot}`}
                  alt="屏幕截图"
                  className="w-full"
                />
              </div>
            ) : (
              <div className="mt-2 flex h-32 items-center justify-center rounded border border-dashed border-border-default text-xs text-content-subtle">
                {isRunning ? '点击「截取屏幕」查看 AI 视角' : '启动后可查看屏幕截图'}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Confirm Dialog */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-80 rounded-lg border border-border-subtle bg-surface-elevated p-4 shadow-xl">
            <h3 className="mb-2 text-sm font-medium text-content-heading">操作确认</h3>
            <p className="mb-1 text-xs text-content-muted">
              AI 请求执行:
            </p>
            <div className="mb-3 rounded bg-surface-overlay px-3 py-2 text-xs text-content-heading">
              <span className="font-medium">{confirmAction.method}</span>
              {Object.keys(confirmAction.params).length > 0 && (
                <pre className="mt-1 text-[10px] text-content-subtle">
                  {JSON.stringify(confirmAction.params, null, 2)}
                </pre>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleConfirmResponse(true)}
                className="flex-1 rounded bg-success px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-success/80"
              >
                允许
              </button>
              <button
                onClick={() => handleConfirmResponse(false)}
                className="flex-1 rounded bg-danger px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-danger/80"
              >
                拒绝
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
