import { useState, useEffect, useCallback } from 'react'

export function UpdateNotification() {
  const [version, setVersion] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [downloaded, setDownloaded] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!window.mixDesktop) return

    const unsubAvailable = window.mixDesktop.onUpdaterAvailable((info: { version: string }) => {
      setVersion(info.version)
      setDismissed(false)
    })

    const unsubProgress = window.mixDesktop.onUpdaterProgress((info: { percent: number }) => {
      setDownloading(true)
      setProgress(info.percent)
    })

    const unsubDownloaded = window.mixDesktop.onUpdaterDownloaded((_info: { version: string }) => {
      setDownloading(false)
      setDownloaded(true)
      setProgress(100)
    })

    const unsubError = window.mixDesktop.onUpdaterError((info: { message: string }) => {
      setError(info.message)
      setDownloading(false)
    })

    return () => {
      unsubAvailable()
      unsubProgress()
      unsubDownloaded()
      unsubError()
    }
  }, [])

  const handleDownload = useCallback(async () => {
    if (!window.mixDesktop) return
    setDownloading(true)
    setError(null)
    await window.mixDesktop.updaterDownload()
  }, [])

  const handleInstall = useCallback(async () => {
    if (!window.mixDesktop) return
    await window.mixDesktop.updaterInstall()
  }, [])

  const handleCheck = useCallback(async () => {
    if (!window.mixDesktop) return
    setError(null)
    await window.mixDesktop.updaterCheck()
  }, [])

  if (dismissed) return null
  if (!version && !downloaded && !error) return null

  return (
    <div className="border-b border-border-subtle bg-surface-elevated px-4 py-2">
      <div className="flex items-center gap-3">
        {downloaded ? (
          <>
            <span className="text-xs text-success">新版本已就绪</span>
            <button
              onClick={handleInstall}
              className="rounded bg-accent px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-accent-hover"
            >
              重启安装
            </button>
          </>
        ) : downloading ? (
          <>
            <span className="text-xs text-content-muted">下载中...</span>
            <div className="flex-1">
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-overlay">
                <div
                  className="h-full rounded-full bg-accent transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
            <span className="text-xs text-content-subtle">{progress}%</span>
          </>
        ) : version ? (
          <>
            <span className="text-xs text-content-heading">新版本 {version} 可用</span>
            <button
              onClick={handleDownload}
              className="rounded bg-accent px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-accent-hover"
            >
              下载更新
            </button>
          </>
        ) : error ? (
          <>
            <span className="text-xs text-danger">更新失败: {error}</span>
            <button
              onClick={handleCheck}
              className="rounded border border-border-default bg-surface-overlay px-2 py-1 text-[10px] text-content-subtle hover:text-content-heading"
            >
              重试
            </button>
          </>
        ) : null}
        <button
          onClick={() => setDismissed(true)}
          className="ml-auto text-xs text-content-subtle hover:text-content-heading"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
