import { join } from 'path'
import { APP_HOME, readJsonFile, writeJsonFile } from './utils'
import type { ConnectionConfig, ProviderConfig } from '../shared/types'

export type { ConnectionConfig }

const CONFIG_FILE = join(APP_HOME, 'desktop.json')

const BUILTIN_PROVIDERS: ProviderConfig[] = [
  {
    id: 'zhipu',
    name: '智谱 AI',
    type: 'zhipu',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    apiKey: '',
    models: ['GLM-5V-Turbo', 'GLM-5-Plus', 'glm-4-flash', 'glm-4-air', 'glm-4-plus', 'glm-4-long', 'glm-4.7'],
    defaultModel: 'GLM-5V-Turbo'
  },
  {
    id: 'openai',
    name: 'OpenAI',
    type: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    models: [
      'gpt-5.5', 'gpt-5.5-pro', 'gpt-5.4-mini', 'gpt-5.4-nano',
      'gpt-4o', 'gpt-4o-mini',
      'o3', 'o4-mini',
      'gpt-image-2'
    ],
    defaultModel: 'gpt-5.5'
  },
  {
    id: 'claude',
    name: 'Claude',
    type: 'claude',
    baseUrl: 'https://api.anthropic.com/v1',
    apiKey: '',
    models: [
      'claude-opus-4-7', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001',
      'claude-sonnet-4-20250514', 'claude-haiku-4-20250506', 'claude-opus-4-20250514'
    ],
    defaultModel: 'claude-sonnet-4-6'
  },
  {
    id: 'ollama',
    name: 'Ollama (本地)',
    type: 'ollama',
    baseUrl: 'http://localhost:11434/v1',
    apiKey: 'ollama',
    models: ['llama4', 'qwen3', 'gemma3', 'mistral-large', 'deepseek-r1', 'codellama'],
    defaultModel: 'llama4'
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    type: 'openai',
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKey: '',
    models: [
      'openai/gpt-5.5', 'openai/gpt-5.4-mini',
      'openai/gpt-4o', 'openai/o3', 'openai/o4-mini',
      'anthropic/claude-opus-4-7', 'anthropic/claude-sonnet-4-6',
      'google/gemini-2.5-pro', 'google/gemini-2.5-flash',
      'meta-llama/llama-4-maverick', 'meta-llama/llama-4-scout',
      'deepseek/deepseek-chat-v3', 'deepseek/deepseek-r1',
      'qwen/qwen3-235b-a22b'
    ],
    defaultModel: 'openai/gpt-5.5'
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    type: 'openai',
    baseUrl: 'https://api.deepseek.com/v1',
    apiKey: '',
    models: ['deepseek-chat-v3', 'deepseek-r1', 'deepseek-chat'],
    defaultModel: 'deepseek-chat-v3',
    discoverable: true
  },
  {
    id: 'chatgpt',
    name: 'ChatGPT (订阅)',
    type: 'chatgpt',
    authType: 'subscription',
    baseUrl: 'https://chatgpt.com/backend-api',
    apiKey: '',
    models: ['gpt-5.5', 'gpt-5.5-pro', 'o3', 'o4-mini', 'gpt-4o', 'gpt-image-2'],
    defaultModel: 'gpt-5.5'
  },
  {
    id: 'hermes',
    name: 'Hermes Agent (本地)',
    type: 'hermes',
    baseUrl: 'http://127.0.0.1:8642/v1',
    apiKey: '',
    models: ['auto'],
    defaultModel: 'auto',
    discoverable: true,
    gatewayManaged: true
  }
]

const DEFAULT_CONFIG: ConnectionConfig = {
  mode: 'remote',
  connectionMode: 'server',
  gatewayUrl: 'http://127.0.0.1:18789',
  langgraphUrl: 'https://open.bigmodel.cn/api/paas/v4',
  langgraphApiKey: '',
  defaultModel: 'GLM-5V-Turbo',
  providers: BUILTIN_PROVIDERS,
  activeProviderId: 'zhipu'
}

let cachedConfig: ConnectionConfig | null = null
let cacheExpiry = 0

export function getConnectionConfig(): ConnectionConfig {
  const now = Date.now()
  if (cachedConfig && now < cacheExpiry) return cachedConfig

  const saved = readJsonFile<Partial<ConnectionConfig>>(CONFIG_FILE, {})
  cachedConfig = { ...DEFAULT_CONFIG, ...saved }
  if (!cachedConfig.providers || cachedConfig.providers.length === 0) {
    cachedConfig.providers = BUILTIN_PROVIDERS
  } else {
    // Merge new builtin models into saved providers
    cachedConfig.providers = cachedConfig.providers.map((p) => {
      const builtin = BUILTIN_PROVIDERS.find((b) => b.id === p.id)
      if (!builtin) return p
      const mergedModels = [...new Set([...builtin.models, ...p.models])]
      return { ...p, models: mergedModels }
    })
    // Add new builtin providers not yet in saved config
    const savedIds = new Set(cachedConfig.providers.map((p) => p.id))
    for (const builtin of BUILTIN_PROVIDERS) {
      if (!savedIds.has(builtin.id)) {
        cachedConfig.providers = [...cachedConfig.providers, builtin]
      }
    }
  }
  cacheExpiry = now + 5000
  return cachedConfig
}

export function setConnectionConfig(config: Partial<ConnectionConfig>): void {
  const current = getConnectionConfig()
  const updated = { ...current, ...config }
  writeJsonFile(CONFIG_FILE, updated)
  cachedConfig = updated
  cacheExpiry = 0
}

export function getActiveProvider(): ProviderConfig {
  const config = getConnectionConfig()
  return config.providers.find((p) => p.id === config.activeProviderId) ?? config.providers[0]
}

export function setActiveProvider(providerId: string): void {
  setConnectionConfig({ activeProviderId: providerId })
}

export function updateProvider(provider: ProviderConfig): void {
  const config = getConnectionConfig()
  const providers = config.providers.map((p) => p.id === provider.id ? provider : p)
  if (!providers.find((p) => p.id === provider.id)) {
    providers.push(provider)
  }
  setConnectionConfig({ providers })
}

export function removeProvider(providerId: string): void {
  const config = getConnectionConfig()
  const providers = config.providers.filter((p) => p.id !== providerId)
  const activeProviderId = config.activeProviderId === providerId
    ? (providers[0]?.id ?? 'zhipu')
    : config.activeProviderId
  setConnectionConfig({ providers, activeProviderId })
}

export function setProviderModel(providerId: string, model: string): void {
  const config = getConnectionConfig()
  const providers = config.providers.map((p) =>
    p.id === providerId ? { ...p, defaultModel: model } : p
  )
  setConnectionConfig({ providers })
}
