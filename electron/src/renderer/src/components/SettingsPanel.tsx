import { genId } from '../lib/genId'
import { useState, useEffect, useCallback } from 'react'
import type { AppLocale } from '../../../shared/i18n/types'
import type { ConnectionConfig, ProviderConfig } from '../../../shared/types'
import { useSandboxStore } from '../stores/sandboxStore'
import type { SandboxLevel } from '../stores/sandboxStore'

const PROVIDER_ICONS: Record<string, string> = {
  zhipu: '🟣',
  openai: '🟢',
  claude: '🟠',
  ollama: '🦙',
  openrouter: '🌐',
  chatgpt: '💬',
  deepseek: '🔵',
  hermes: '⚡',
  custom: '⚙️'
}

export function SettingsPanel() {
  const [locale, setLocalLocale] = useState<AppLocale>('zh-CN')
  const [connectionMode, setConnectionMode] = useState<'server' | 'direct'>('direct')
  const [gatewayUrl, setGatewayUrl] = useState('http://127.0.0.1:18789')
  const [providers, setProviders] = useState<ProviderConfig[]>([])
  const [activeId, setActiveId] = useState('zhipu')
  const [editingProvider, setEditingProvider] = useState<ProviderConfig | null>(null)
  const [saved, setSaved] = useState(false)
  const [updateCheckStatus, setUpdateCheckStatus] = useState<'idle' | 'checking' | 'available' | 'latest' | 'error'>('idle')
  const sandboxLevel = useSandboxStore((s) => s.level)
  const setSandboxLevel = useSandboxStore((s) => s.setLevel)

  useEffect(() => {
    if (!window.mixDesktop) return
    window.mixDesktop.getLocale().then(setLocalLocale).catch(() => {})
    window.mixDesktop.getConnectionConfig().then((config: ConnectionConfig) => {
      setProviders(config.providers ?? [])
      setActiveId(config.activeProviderId ?? 'zhipu')
      setConnectionMode(config.connectionMode ?? 'direct')
      setGatewayUrl(config.gatewayUrl ?? 'http://127.0.0.1:18789')
    }).catch(() => {})
  }, [])

  const handleSave = useCallback(async () => {
    if (!window.mixDesktop) return
    try {
      await window.mixDesktop.setConnectionConfig({ providers, activeProviderId: activeId, connectionMode, gatewayUrl })
      await window.mixDesktop.setLocale(locale)
      if (editingProvider) {
        await window.mixDesktop.updateProvider(editingProvider)
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      // silently fail
    }
  }, [providers, activeId, locale, editingProvider])

  const handleSetActive = useCallback(async (id: string) => {
    setActiveId(id)
    if (window.mixDesktop) {
      await window.mixDesktop.setActiveProvider(id)
    }
  }, [])

  const activeProvider = providers.find((p) => p.id === activeId) ?? providers[0]

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-border-subtle px-4 py-2">
        <h2 className="text-sm font-medium text-content-heading">设置</h2>
        <button
          onClick={handleSave}
          className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
            saved
              ? 'bg-success text-white'
              : 'bg-accent text-white hover:bg-accent-hover'
          }`}
        >
          {saved ? '已保存' : '保存'}
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-lg space-y-6">

          {/* Connection Mode */}
          <section>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-content-subtle">
              连接模式
            </h3>
            <div className="rounded-lg border border-border-subtle bg-surface-primary p-3 space-y-3">
              <div className="flex gap-3">
                <button
                  onClick={() => setConnectionMode('server')}
                  className={`flex-1 rounded-md px-3 py-2 text-xs font-medium transition-colors ${
                    connectionMode === 'server'
                      ? 'bg-accent text-white'
                      : 'bg-surface-secondary text-content-secondary hover:bg-surface-hover'
                  }`}
                >
                  Server 模式
                </button>
                <button
                  onClick={() => setConnectionMode('direct')}
                  className={`flex-1 rounded-md px-3 py-2 text-xs font-medium transition-colors ${
                    connectionMode === 'direct'
                      ? 'bg-accent text-white'
                      : 'bg-surface-secondary text-content-secondary hover:bg-surface-hover'
                  }`}
                >
                  Direct 模式
                </button>
              </div>
              {connectionMode === 'server' && (
                <div className="text-xs text-content-secondary">
                  通过 MIX Gateway ({gatewayUrl}) 连接 Engine
                </div>
              )}
              {connectionMode === 'direct' && (
                <div className="text-xs text-content-secondary">
                  直连 LLM Provider API，无需本地服务
                </div>
              )}
            </div>
          </section>

          {/* API Provider */}
          <section>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-content-subtle">
              API 服务商
            </h3>
            <div className="space-y-3 rounded-lg border border-border-subtle bg-surface-elevated p-4">
              {/* Provider tabs */}
              <div className="flex flex-wrap gap-1.5">
                {providers.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleSetActive(p.id)}
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                      activeId === p.id
                        ? 'border-accent/50 bg-accent/15 text-accent-text'
                        : 'border-border-default text-content-subtle hover:bg-surface-overlay hover:text-content-heading'
                    }`}
                  >
                    <span>{PROVIDER_ICONS[p.type] ?? '⚙️'}</span>
                    <span>{p.name}</span>
                    {activeId === p.id && <span className="h-1.5 w-1.5 rounded-full bg-success" />}
                  </button>
                ))}
                <button
                  onClick={() => setEditingProvider({
                    id: genId('custom-'), name: '自定义', type: 'custom',
                    baseUrl: '', apiKey: '', models: [''], defaultModel: ''
                  })}
                  className="rounded-lg border border-dashed border-border-default px-3 py-1.5 text-xs text-content-subtle hover:border-border-subtle hover:text-content-muted"
                >
                  + 添加
                </button>
              </div>

              {/* Active provider config */}
              {activeProvider && (
                <ProviderConfigForm
                  provider={editingProvider && editingProvider.id === activeProvider.id ? editingProvider : activeProvider}
                  onChange={setEditingProvider}
                />
              )}
            </div>
          </section>

          {/* Model selection */}
          <section>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-content-subtle">
              当前模型
            </h3>
            <div className="rounded-lg border border-border-subtle bg-surface-elevated p-4">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-success" />
                <span className="text-sm text-content-heading">{activeProvider?.defaultModel ?? '未选择'}</span>
                <span className="text-xs text-content-subtle">({activeProvider?.name})</span>
              </div>
            </div>
          </section>

          {/* UI settings */}
          <section>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-content-subtle">
              界面设置
            </h3>
            <div className="space-y-3 rounded-lg border border-border-subtle bg-surface-elevated p-4">
              <label className="flex items-center gap-3 text-sm">
                <span className="w-20 shrink-0 text-content-subtle">语言</span>
                <div className="flex gap-1">
                  {([['zh-CN', '简体中文'], ['en', 'English']] as const).map(([val, label]) => (
                    <button
                      key={val}
                      onClick={() => setLocalLocale(val)}
                      className={`rounded px-3 py-1.5 text-xs transition-colors ${
                        locale === val
                          ? 'bg-accent text-white'
                          : 'bg-surface-overlay text-content-subtle hover:text-content-heading'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </label>
            </div>
          </section>

          {/* Sandbox Security */}
          <section>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-content-subtle">
              沙箱安全
            </h3>
            <div className="space-y-3 rounded-lg border border-border-subtle bg-surface-elevated p-4">
              <div className="flex flex-col gap-2">
                {([
                  { level: 'read-only' as SandboxLevel, label: '只读', desc: 'AI 只能读取文件，不能修改或执行命令', color: 'bg-success' },
                  { level: 'workspace-write' as SandboxLevel, label: '工作区写入', desc: 'AI 可在项目目录内写文件和执行命令', color: 'bg-warning' },
                  { level: 'full-access' as SandboxLevel, label: '完全访问', desc: 'AI 拥有完全访问权限（需谨慎）', color: 'bg-danger' },
                ]).map(({ level, label, desc, color }) => (
                  <button
                    key={level}
                    onClick={() => setSandboxLevel(level)}
                    className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${
                      sandboxLevel === level
                        ? 'border-accent/50 bg-accent/10'
                        : 'border-border-default hover:bg-surface-overlay'
                    }`}
                  >
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${color} ${
                      sandboxLevel === level ? 'ring-2 ring-accent/30 ring-offset-1 ring-offset-surface-elevated' : ''
                    }`} />
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-content-heading">{label}</div>
                      <div className="text-[10px] text-content-subtle">{desc}</div>
                    </div>
                  </button>
                ))}
              </div>
              <div className="rounded bg-surface-overlay/50 px-3 py-2 text-[10px] text-content-subtle">
                当前级别：{sandboxLevel === 'read-only' ? '只读' : sandboxLevel === 'workspace-write' ? '工作区写入' : '完全访问'}
                {sandboxLevel === 'full-access' && (
                  <span className="ml-1 text-danger">-- 请确保你了解相关风险</span>
                )}
              </div>
            </div>
          </section>

          {/* Notifications */}
          <section>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-content-subtle">
              通知
            </h3>
            <div className="space-y-3 rounded-lg border border-border-subtle bg-surface-elevated p-4">
              <button
                onClick={() => {
                  if (window.mixDesktop) {
                    window.mixDesktop.sendNotification({ title: 'AI GUI 通知测试', body: '如果你看到这条系统通知，说明桌面通知工作正常！' })
                  }
                }}
                className="w-full rounded-lg border border-border-default bg-surface-overlay px-3 py-2 text-xs text-content-muted transition-colors hover:bg-surface-inset hover:text-content-secondary"
              >
                发送测试通知
              </button>
              <div className="space-y-2 text-[10px] text-content-subtle">
                <p>通知触发场景：</p>
                <div className="grid grid-cols-2 gap-1">
                  <span className="rounded bg-surface-overlay px-2 py-1">⏰ 定时任务触发</span>
                  <span className="rounded bg-surface-overlay px-2 py-1">⏰ 定时任务失败</span>
                  <span className="rounded bg-surface-overlay px-2 py-1">🔀 工作流完成</span>
                  <span className="rounded bg-surface-overlay px-2 py-1">🔀 工作流失败</span>
                  <span className="rounded bg-surface-overlay px-2 py-1">💬 聊天错误</span>
                  <span className="rounded bg-surface-overlay px-2 py-1">🔄 长时任务完成</span>
                </div>
              </div>
            </div>
          </section>

          {/* About */}
          <section>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-content-subtle">
              关于
            </h3>
            <div className="space-y-2 rounded-lg border border-border-subtle bg-surface-elevated p-4">
              {[
                ['版本', '0.5.0'],
                ['Electron', '39'],
                ['React', '19'],
                ['Three.js', '0.175']
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between text-sm">
                  <span className="text-content-subtle">{k}</span>
                  <span className="text-content-muted">{v}</span>
                </div>
              ))}
              <button
                onClick={async () => {
                  if (!window.mixDesktop) return
                  setUpdateCheckStatus('checking')
                  try {
                    const status = await window.mixDesktop.updaterCheck() as { available: boolean; version: string | null }
                    setUpdateCheckStatus(status.available ? 'available' : 'latest')
                  } catch {
                    setUpdateCheckStatus('error')
                  }
                  setTimeout(() => setUpdateCheckStatus('idle'), 3000)
                }}
                disabled={updateCheckStatus === 'checking'}
                className="mt-2 w-full rounded-lg border border-border-default bg-surface-overlay px-3 py-2 text-xs text-content-muted transition-colors hover:bg-surface-inset hover:text-content-secondary disabled:opacity-50"
              >
                {updateCheckStatus === 'checking' ? '检查中...' : updateCheckStatus === 'available' ? '✓ 发现新版本' : updateCheckStatus === 'latest' ? '✓ 已是最新版本' : updateCheckStatus === 'error' ? '✗ 检查失败' : '检查更新'}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function ProviderConfigForm({ provider, onChange }: { provider: ProviderConfig; onChange: (p: ProviderConfig) => void }) {
  const [loginStatus, setLoginStatus] = useState<'idle' | 'logging' | 'done' | 'error'>('idle')
  const [showKey, setShowKey] = useState(false)
  const [testResult, setTestResult] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle')
  const [discoverStatus, setDiscoverStatus] = useState<'idle' | 'discovering' | 'done' | 'fail'>('idle')
  const update = (field: keyof ProviderConfig, value: string) => {
    onChange({ ...provider, [field]: value })
  }

  const handleLogin = async () => {
    if (!window.mixDesktop) return
    setLoginStatus('logging')
    try {
      const session = await window.mixDesktop.chatgptLogin()
      if (session?.accessToken) {
        onChange({ ...provider, apiKey: session.accessToken })
        setLoginStatus('done')
      } else {
        setLoginStatus('error')
      }
    } catch {
      setLoginStatus('error')
    }
  }

  const handleLogout = async () => {
    if (!window.mixDesktop) return
    await window.mixDesktop.chatgptLogout()
    onChange({ ...provider, apiKey: '' })
    setLoginStatus('idle')
  }

  // ChatGPT subscription uses browser login, no manual URL/Key fields
  if (provider.authType === 'subscription' || provider.type === 'chatgpt') {
    return (
      <div className="space-y-3 border-t border-border-subtle pt-3">
        <div className="rounded-lg bg-surface-overlay/50 p-3">
          <p className="text-xs text-content-muted">
            使用你的 ChatGPT Plus/Pro 订阅直接登录，无需 API Key。
          </p>
        </div>

        {provider.apiKey ? (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success-bg px-3 py-2">
              <span className="h-2 w-2 rounded-full bg-success" />
              <span className="text-xs text-success">已登录</span>
            </div>
            <button
              onClick={handleLogout}
              className="rounded-lg border border-border-default bg-surface-overlay px-3 py-2 text-xs text-content-muted transition-colors hover:bg-surface-inset"
            >
              退出登录
            </button>
          </div>
        ) : (
          <button
            onClick={handleLogin}
            disabled={loginStatus === 'logging'}
            className="w-full rounded-lg bg-success px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-success/80 disabled:opacity-50"
          >
            {loginStatus === 'logging' ? '等待登录...' : '登录 ChatGPT'}
          </button>
        )}

        {loginStatus === 'error' && (
          <p className="text-xs text-danger">登录失败，请重试</p>
        )}

        <label className="flex items-center gap-3 text-sm">
          <span className="w-20 shrink-0 text-content-subtle">模型</span>
          <select
            value={provider.defaultModel}
            onChange={(e) => update('defaultModel', e.target.value)}
            className="rounded border border-border-default bg-surface-overlay px-3 py-1.5 text-sm text-content-heading"
          >
            {provider.models.map((m) => (
              <option key={m} value={m}>{m}{m === 'o1-pro' ? ' (Pro)' : ''}</option>
            ))}
          </select>
        </label>
      </div>
    )
  }

  return (
    <div className="space-y-3 border-t border-border-subtle pt-3">
      {/* Hermes Gateway status */}
      {provider.gatewayManaged && <HermesGatewayCard />}

      <label className="flex items-center gap-3 text-sm">
        <span className="w-20 shrink-0 text-content-subtle">API URL</span>
        <input
          type="text"
          value={provider.baseUrl}
          onChange={(e) => update('baseUrl', e.target.value)}
          className="flex-1 rounded border border-border-default bg-surface-overlay px-3 py-1.5 text-content-heading outline-none transition-colors focus:border-accent"
        />
      </label>

      <label className="flex items-center gap-3 text-sm">
        <span className="w-20 shrink-0 text-content-subtle">API Key</span>
        <div className="flex flex-1 items-center gap-1">
          <input
            type={showKey ? 'text' : 'password'}
            value={provider.apiKey}
            onChange={(e) => update('apiKey', e.target.value)}
            placeholder={provider.type === 'ollama' ? '无需 Key' : '粘贴你的 API Key...'}
            className="flex-1 rounded border border-border-default bg-surface-overlay px-3 py-1.5 text-content-heading outline-none transition-colors focus:border-accent"
          />
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            className="rounded border border-border-default bg-surface-overlay px-2 py-1.5 text-xs text-content-subtle hover:text-content-heading"
            title={showKey ? '隐藏' : '显示'}
          >
            {showKey ? '◉' : '○'}
          </button>
        </div>
      </label>

      <label className="flex items-center gap-3 text-sm">
        <span className="w-20 shrink-0 text-content-subtle">模型</span>
        <select
          value={provider.defaultModel}
          onChange={(e) => update('defaultModel', e.target.value)}
          className="rounded border border-border-default bg-surface-overlay px-3 py-1.5 text-sm text-content-heading"
        >
          {provider.models.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <button
          onClick={async () => {
            if (!window.mixDesktop) return
            setDiscoverStatus('discovering')
            try {
              const models = await window.mixDesktop.discoverModels(provider.id) as Array<{ id: string; name?: string }>
              if (models.length > 0) {
                const newModels = models.map((m) => m.id)
                const merged = [...new Set([...newModels, ...provider.models])]
                onChange({ ...provider, models: merged })
                setDiscoverStatus('done')
              } else {
                setDiscoverStatus('fail')
              }
            } catch {
              setDiscoverStatus('fail')
            }
            setTimeout(() => setDiscoverStatus('idle'), 3000)
          }}
          disabled={discoverStatus === 'discovering'}
          className="rounded border border-border-default bg-surface-elevated px-2 py-1.5 text-[10px] text-content-subtle transition-colors hover:bg-surface-overlay hover:text-content-heading disabled:opacity-50"
        >
          {discoverStatus === 'discovering' ? '发现中...' : discoverStatus === 'done' ? `✓ 已发现` : discoverStatus === 'fail' ? '✗ 无结果' : '发现模型'}
        </button>
      </label>

      <div className="flex items-center gap-2 rounded bg-accent/10 px-3 py-2">
        <span className="text-xs text-accent-text">{PROVIDER_ICONS[provider.type]} {provider.name}</span>
        <span className="text-[10px] text-content-subtle">
          {provider.type === 'ollama' ? '本地运行 · 无需 API Key' : provider.type === 'zhipu' ? '按量计费 · flash 模型免费' : provider.type === 'hermes' ? '本地 Agent · OpenAI 兼容' : '按量计费'}
        </span>
        <button
          onClick={async () => {
            setTestResult('testing')
            try {
              const res = await fetch(provider.baseUrl.replace(/\/$/, '') + '/models', {
                headers: provider.apiKey ? { 'Authorization': `Bearer ${provider.apiKey}` } : {},
                signal: AbortSignal.timeout(5000)
              })
              setTestResult(res.ok ? 'ok' : 'fail')
            } catch { setTestResult('fail') }
            setTimeout(() => setTestResult('idle'), 3000)
          }}
          disabled={testResult === 'testing'}
          className="ml-auto rounded border border-border-default bg-surface-elevated px-2 py-0.5 text-[10px] text-content-subtle transition-colors hover:bg-surface-overlay hover:text-content-heading disabled:opacity-50"
        >
          {testResult === 'testing' ? '测试中...' : testResult === 'ok' ? '✓ 连接成功' : testResult === 'fail' ? '✗ 连接失败' : '测试连接'}
        </button>
      </div>
    </div>
  )
}

function HermesGatewayCard() {
  const [status, setStatus] = useState<{ running: boolean; apiKeyConfigured: boolean; cliAvailable: boolean } | null>(null)
  const [busy, setBusy] = useState<'start' | 'stop' | 'key' | null>(null)

  useEffect(() => {
    if (!window.mixDesktop) return
    window.mixDesktop.hermesGetStatus().then(setStatus).catch(() => {})
    const unsub = window.mixDesktop.onHermesStatusChanged((s: { running: boolean }) => {
      if (s.running) {
        window.mixDesktop.hermesGetStatus().then(setStatus).catch(() => {})
      } else {
        setStatus((prev) => prev ? { ...prev, running: false } : null)
      }
    })
    return unsub
  }, [])

  const handleStart = async () => {
    if (!window.mixDesktop) return
    setBusy('start')
    await window.mixDesktop.hermesStartGateway()
    const s = await window.mixDesktop.hermesGetStatus()
    setStatus(s)
    setBusy(null)
  }

  const handleStop = async () => {
    if (!window.mixDesktop) return
    setBusy('stop')
    await window.mixDesktop.hermesStopGateway()
    const s = await window.mixDesktop.hermesGetStatus()
    setStatus(s)
    setBusy(null)
  }

  const handleReadKey = async () => {
    if (!window.mixDesktop) return
    setBusy('key')
    await window.mixDesktop.hermesResolveApiKey('hermes')
    const s = await window.mixDesktop.hermesGetStatus()
    setStatus(s)
    setBusy(null)
  }

  return (
    <div className="rounded-lg border border-border-subtle bg-surface-overlay/30 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${status?.running ? 'bg-success' : 'bg-content-subtle/40'}`} />
          <span className="text-xs text-content-heading">
            {status?.running ? '网关运行中' : status === null ? '检测中...' : '网关已停止'}
          </span>
        </div>
        <span className="text-[10px] text-content-subtle">本地 Agent · OpenAI 兼容</span>
      </div>
      <div className="flex gap-2">
        {status?.running ? (
          <button
            onClick={handleStop}
            disabled={busy === 'stop'}
            className="rounded border border-border-default bg-surface-elevated px-3 py-1 text-xs text-content-subtle hover:text-danger disabled:opacity-50"
          >
            {busy === 'stop' ? '停止中...' : '停止网关'}
          </button>
        ) : (
          <button
            onClick={handleStart}
            disabled={busy === 'start' || !status?.cliAvailable}
            className="rounded border border-accent/30 bg-accent/10 px-3 py-1 text-xs text-accent-text hover:bg-accent/20 disabled:opacity-50"
          >
            {busy === 'start' ? '启动中...' : '启动网关'}
          </button>
        )}
        <button
          onClick={handleReadKey}
          disabled={busy === 'key'}
          className="rounded border border-border-default bg-surface-elevated px-3 py-1 text-xs text-content-subtle hover:text-content-heading disabled:opacity-50"
        >
          {busy === 'key' ? '读取中...' : '从配置读取密钥'}
        </button>
      </div>
      {!status?.cliAvailable && status !== null && (
        <p className="text-[10px] text-danger">Hermes CLI 未找到，请确认已安装 Hermes Agent</p>
      )}
    </div>
  )
}
