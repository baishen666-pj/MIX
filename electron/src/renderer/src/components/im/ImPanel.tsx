import { useState, useEffect, useCallback } from 'react'
import { useImStore } from '../../stores/imStore'

type Platform = 'feishu' | 'wecom' | 'wecom-webhook'

interface PlatformConfig {
  platform: Platform
  label: string
  icon: string
  fields: { key: string; label: string; type: string }[]
}

const PLATFORMS: PlatformConfig[] = [
  {
    platform: 'feishu',
    label: '飞书',
    icon: '🐦',
    fields: [
      { key: 'appId', label: 'App ID', type: 'text' },
      { key: 'appSecret', label: 'App Secret', type: 'password' }
    ]
  },
  {
    platform: 'wecom',
    label: '企业微信',
    icon: '💼',
    fields: [
      { key: 'corpId', label: 'Corp ID', type: 'text' },
      { key: 'corpSecret', label: 'Corp Secret', type: 'password' },
      { key: 'agentId', label: 'Agent ID', type: 'number' }
    ]
  },
  {
    platform: 'wecom-webhook',
    label: '企微群机器人',
    icon: '🔗',
    fields: [
      { key: 'key', label: 'Webhook Key', type: 'text' }
    ]
  }
]

export function ImPanel() {
  const connectors = useImStore((s) => s.connectors)
  const messages = useImStore((s) => s.messages)
  const addMessage = useImStore((s) => s.addMessage)
  const setConnectors = useImStore((s) => s.setConnectors)

  const [config, setConfig] = useState<Record<string, string>>({})
  const [starting, setStarting] = useState<string | null>(null)

  useEffect(() => {
    if (!window.mixDesktop) return
    window.mixDesktop.imStatus().then(setConnectors).catch(() => {})

    const unsubMsg = window.mixDesktop.onImMessage((msg: Record<string, unknown>) => {
      addMessage(msg as { platform: string; chatId: string; userId: string; text: string; timestamp: number })
    })
    const unsubStatus = window.mixDesktop.onImStatus((statuses: Array<{ platform: string; running: boolean }>) => {
      setConnectors(statuses)
    })

    return () => { unsubMsg(); unsubStatus() }
  }, [addMessage, setConnectors])

  const handleStart = useCallback(async (platform: Platform) => {
    if (!window.mixDesktop) return
    setStarting(platform)
    try {
      const platformConfig = PLATFORMS.find((p) => p.platform === platform)
      if (!platformConfig) return

      const cfg: Record<string, unknown> = { platform }
      for (const field of platformConfig.fields) {
        const val = config[`${platform}-${field.key}`] || ''
        if (!val) return
        cfg[field.key] = field.type === 'number' ? Number(val) : val
      }

      await window.mixDesktop.imStart(cfg)
    } finally {
      setStarting(null)
    }
  }, [config])

  const handleStop = useCallback(async (platform: string) => {
    if (!window.mixDesktop) return
    await window.mixDesktop.imStop(platform)
  }, [])

  const updateConfig = (platform: string, key: string, value: string) => {
    setConfig((prev) => ({ ...prev, [`${platform}-${key}`]: value }))
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-border-subtle px-4 py-2">
        <h2 className="text-sm font-medium text-content-heading">IM 远程控制</h2>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-lg space-y-4">
          {PLATFORMS.map((p) => {
            const conn = connectors.find((c) => c.platform === p.platform)
            const isRunning = conn?.running ?? false

            return (
              <section key={p.platform} className="rounded-lg border border-border-subtle bg-surface-elevated p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span>{p.icon}</span>
                    <span className="text-sm font-medium text-content-heading">{p.label}</span>
                    <span className={`h-2 w-2 rounded-full ${isRunning ? 'bg-success animate-pulse' : 'bg-content-subtle'}`} />
                  </div>
                  {isRunning ? (
                    <button
                      onClick={() => handleStop(p.platform)}
                      className="rounded bg-danger px-3 py-1 text-xs text-white hover:bg-danger/80"
                    >
                      停止
                    </button>
                  ) : (
                    <button
                      onClick={() => handleStart(p.platform)}
                      disabled={starting === p.platform}
                      className="rounded bg-accent px-3 py-1 text-xs text-white hover:bg-accent-hover disabled:opacity-50"
                    >
                      {starting === p.platform ? '启动中...' : '启动'}
                    </button>
                  )}
                </div>

                {!isRunning && (
                  <div className="mt-3 space-y-2">
                    {p.fields.map((field) => (
                      <label key={field.key} className="flex items-center gap-3 text-sm">
                        <span className="w-24 shrink-0 text-content-subtle">{field.label}</span>
                        <input
                          type={field.type}
                          value={config[`${p.platform}-${field.key}`] || ''}
                          onChange={(e) => updateConfig(p.platform, field.key, e.target.value)}
                          className="flex-1 rounded border border-border-default bg-surface-overlay px-3 py-1.5 text-content-heading outline-none transition-colors focus:border-accent"
                        />
                      </label>
                    ))}
                  </div>
                )}
              </section>
            )
          })}

          {/* Message Log */}
          <section className="rounded-lg border border-border-subtle bg-surface-elevated p-4">
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-content-subtle">消息日志</h3>
            <div className="max-h-60 space-y-1 overflow-y-auto">
              {messages.length === 0 ? (
                <div className="flex h-20 items-center justify-center text-xs text-content-subtle">
                  启动连接器后，消息将显示在这里
                </div>
              ) : (
                messages.map((msg, i) => (
                  <div key={i} className="rounded bg-surface-overlay px-3 py-1.5 text-xs">
                    <span className="text-content-subtle">{new Date(msg.timestamp).toLocaleTimeString('zh-CN')}</span>
                    <span className="ml-2 text-content-heading">{msg.text}</span>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
