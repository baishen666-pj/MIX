import { useState, useEffect, useRef, useCallback } from 'react'
import type { ConnectionConfig, ProviderConfig } from '../../../../shared/types'

interface ModelSwitcherProps {
  onOpenSettings: () => void
}

export function ModelSwitcher({ onOpenSettings }: ModelSwitcherProps) {
  const [open, setOpen] = useState(false)
  const [providers, setProviders] = useState<ProviderConfig[]>([])
  const [activeId, setActiveId] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!window.mixDesktop) return
    window.mixDesktop.getConnectionConfig().then((config: ConnectionConfig) => {
      setProviders(config.providers ?? [])
      setActiveId(config.activeProviderId ?? '')
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const activeProvider = providers.find((p) => p.id === activeId) ?? providers[0]

  const handleSwitch = useCallback(async (providerId: string, model: string) => {
    if (!window.mixDesktop) return
    await window.mixDesktop.setActiveProvider(providerId)
    await window.mixDesktop.setProviderModel(providerId, model)
    setActiveId(providerId)
    setOpen(false)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-md border border-border-subtle bg-surface-elevated px-2 py-1 text-[11px] text-content-muted transition-colors hover:border-border-default hover:text-content-secondary"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-success" />
        <span className="max-w-[120px] truncate">{activeProvider?.name ?? '...'}</span>
        <span className="text-content-subtle">/</span>
        <span className="max-w-[100px] truncate">{activeProvider?.defaultModel ?? '...'}</span>
        <span className="text-content-subtle">▾</span>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-80 w-64 overflow-y-auto rounded-lg border border-border-subtle bg-surface-elevated shadow-lg">
          {providers.map((p) => (
            <div key={p.id}>
              <div className="sticky top-0 bg-surface-elevated px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider text-content-subtle">
                {p.name}
              </div>
              {p.models.map((m) => (
                <button
                  key={m}
                  onClick={() => handleSwitch(p.id, m)}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-[11px] transition-colors hover:bg-surface-overlay ${
                    activeId === p.id && activeProvider?.defaultModel === m
                      ? 'text-accent-text bg-accent/10'
                      : 'text-content-muted'
                  }`}
                >
                  {activeId === p.id && activeProvider?.defaultModel === m && (
                    <span className="h-1.5 w-1.5 rounded-full bg-success" />
                  )}
                  <span className="truncate">{m}</span>
                </button>
              ))}
            </div>
          ))}
          <div className="border-t border-border-subtle">
            <button
              onClick={() => { setOpen(false); onOpenSettings() }}
              className="flex w-full items-center gap-2 px-3 py-2 text-[11px] text-content-subtle transition-colors hover:bg-surface-overlay hover:text-content-muted"
            >
              ⚙️ 设置...
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
