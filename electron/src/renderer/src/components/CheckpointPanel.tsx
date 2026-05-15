import { useState, useEffect, useCallback } from 'react'
import { useCheckpointStore } from '../stores/checkpointStore'
import type { CheckpointItem } from '../stores/checkpointStore'
import { useConfirm } from '../hooks/useConfirm'
import { ConfirmDialog } from './ConfirmDialog'

export function CheckpointPanel() {
  const checkpoints = useCheckpointStore((s) => s.checkpoints)
  const isLoading = useCheckpointStore((s) => s.isLoading)
  const error = useCheckpointStore((s) => s.error)
  const setCheckpoints = useCheckpointStore((s) => s.setCheckpoints)
  const removeCheckpoint = useCheckpointStore((s) => s.removeCheckpoint)
  const setLoading = useCheckpointStore((s) => s.setLoading)
  const setError = useCheckpointStore((s) => s.setError)

  const [restoring, setRestoring] = useState<string | null>(null)
  const { confirmState, requestConfirm, handleCancel } = useConfirm()

  useEffect(() => {
    loadCheckpoints()
  }, [])

  const loadCheckpoints = useCallback(async () => {
    if (!window.mixDesktop) return
    setLoading(true)
    setError(null)
    try {
      const items = await window.mixDesktop.checkpointList()
      setCheckpoints(items as CheckpointItem[])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '加载检查点失败')
    } finally {
      setLoading(false)
    }
  }, [setCheckpoints, setLoading, setError])

  const handleRestore = useCallback(async (cp: CheckpointItem) => {
    const confirmed = await requestConfirm(
      '恢复检查点',
      `确定恢复到检查点「${cp.description}」？当前未保存的更改将丢失。`
    )
    if (!confirmed) return

    setRestoring(cp.id)
    try {
      if (window.mixDesktop) {
        await window.mixDesktop.checkpointRestore(cp.id)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '恢复失败')
    } finally {
      setRestoring(null)
    }
  }, [requestConfirm, setError])

  const handleDelete = useCallback(async (cp: CheckpointItem) => {
    const confirmed = await requestConfirm(
      '删除检查点',
      `确定删除检查点「${cp.description}」？此操作不可撤销。`
    )
    if (!confirmed) return

    try {
      if (window.mixDesktop) {
        await window.mixDesktop.checkpointDelete(cp.id, cp.sessionId)
      }
      removeCheckpoint(cp.id)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '删除失败')
    }
  }, [requestConfirm, removeCheckpoint, setError])

  const formatTime = (ts: number): string => {
    const d = new Date(ts)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-border-subtle px-4 py-2">
        <h2 className="text-sm font-medium text-content-heading">检查点</h2>
        <div className="flex gap-2">
          <button
            onClick={loadCheckpoints}
            disabled={isLoading}
            className="rounded px-2 py-1 text-xs text-content-subtle hover:bg-surface-overlay hover:text-content-heading disabled:opacity-50"
          >
            {isLoading ? '加载中...' : '刷新'}
          </button>
          <button
            onClick={async () => {
              if (!window.mixDesktop) return
              setLoading(true)
              try {
                const cp = await window.mixDesktop.checkpointCreate('manual', '手动创建的检查点')
                if (cp) {
                  const item = cp as CheckpointItem
                  const store = useCheckpointStore.getState()
                  store.addCheckpoint(item)
                }
              } catch (err: unknown) {
                setError(err instanceof Error ? err.message : '创建检查点失败')
              } finally {
                setLoading(false)
              }
            }}
            disabled={isLoading}
            className="rounded bg-accent px-3 py-1 text-xs text-white hover:bg-accent-hover disabled:opacity-50"
          >
            创建检查点
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        {error && (
          <div className="mb-3 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
            {error}
          </div>
        )}

        {checkpoints.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-overlay text-2xl">
              &#x1F4BE;
            </div>
            <div>
              <p className="text-sm font-medium text-content-heading">暂无检查点</p>
              <p className="mt-1 text-xs text-content-subtle">点击上方「创建检查点」保存当前项目状态</p>
            </div>
          </div>
        )}

        <div className="mx-auto max-w-lg space-y-2">
          {checkpoints.map((cp) => (
            <div
              key={cp.id}
              className="group rounded-lg border border-border-subtle bg-surface-elevated p-3 transition-colors hover:border-border-default"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-content-heading truncate">
                      {cp.description}
                    </span>
                    <span className="shrink-0 rounded bg-surface-overlay px-1.5 py-0.5 text-[10px] text-content-subtle">
                      {cp.fileCount} 文件
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[10px] text-content-subtle">
                    <span>{formatTime(cp.createdAt)}</span>
                    <span className="truncate">{cp.id}</span>
                  </div>
                </div>

                <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={() => handleRestore(cp)}
                    disabled={restoring === cp.id}
                    className="rounded px-2 py-1 text-xs text-accent-text hover:bg-accent/10 disabled:opacity-50"
                    title="恢复到此检查点"
                  >
                    {restoring === cp.id ? '恢复中...' : '恢复'}
                  </button>
                  <button
                    onClick={() => handleDelete(cp)}
                    className="rounded px-2 py-1 text-xs text-content-subtle hover:bg-surface-overlay hover:text-danger"
                    title="删除此检查点"
                  >
                    删除
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <ConfirmDialog {...confirmState} onCancel={handleCancel} />
    </div>
  )
}
