import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { join } from 'path'
import { mkdirSync, rmSync, writeFileSync } from 'fs'

const { TMP_DIR, mockReadJsonFile, mockWriteJsonFile } = vi.hoisted(() => {
  // Use require() inside hoisted block since imports aren't available yet
  const path = require('path') as typeof import('path')
  const dir = path.join(__dirname, '__tmp_config_test__')
  return {
    TMP_DIR: dir,
    mockReadJsonFile: vi.fn(<T>(filePath: string, fallback: T): T => {
      const fs = require('fs')
      if (!fs.existsSync(filePath)) return fallback
      try {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T
      } catch {
        return fallback
      }
    }),
    mockWriteJsonFile: vi.fn((filePath: string, data: unknown): void => {
      const fs = require('fs')
      const p = require('path') as typeof import('path')
      const d = p.join(filePath, '..')
      if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true })
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
    })
  }
})

vi.mock('../utils', () => ({
  APP_HOME: TMP_DIR,
  readJsonFile: mockReadJsonFile,
  writeJsonFile: mockWriteJsonFile
}))

import {
  getConnectionConfig,
  setConnectionConfig,
  getActiveProvider,
  setActiveProvider,
  updateProvider,
  removeProvider
} from '../config'

beforeEach(() => {
  mkdirSync(TMP_DIR, { recursive: true })
})

afterEach(() => {
  rmSync(TMP_DIR, { recursive: true, force: true })
})

describe('getConnectionConfig', () => {
  it('returns default config when no saved file', () => {
    const config = getConnectionConfig()
    expect(config.mode).toBe('remote')
    expect(config.providers.length).toBeGreaterThan(0)
    expect(config.activeProviderId).toBe('zhipu')
  })

  it('merges saved config over defaults', () => {
    // Bust the cache so it reads from disk
    setConnectionConfig({})
    const configPath = join(TMP_DIR, 'desktop.json')
    writeFileSync(configPath, JSON.stringify({ mode: 'local', defaultModel: 'custom-model' }), 'utf-8')
    const config = getConnectionConfig()
    expect(config.mode).toBe('local')
    expect(config.defaultModel).toBe('custom-model')
    expect(config.providers.length).toBeGreaterThan(0)
  })

  it('restores default providers when saved providers are empty', () => {
    // Bust the cache so it reads from disk
    setConnectionConfig({})
    const configPath = join(TMP_DIR, 'desktop.json')
    writeFileSync(configPath, JSON.stringify({ providers: [] }), 'utf-8')
    const config = getConnectionConfig()
    expect(config.providers.length).toBeGreaterThan(0)
  })
})

describe('setConnectionConfig', () => {
  it('writes partial config and updates cache', () => {
    setConnectionConfig({ mode: 'local' })
    const config = getConnectionConfig()
    expect(config.mode).toBe('local')
  })

  it('overwrites existing values', () => {
    setConnectionConfig({ defaultModel: 'test-model' })
    const config = getConnectionConfig()
    expect(config.defaultModel).toBe('test-model')
  })
})

describe('getActiveProvider', () => {
  it('returns the active provider by id', () => {
    const provider = getActiveProvider()
    expect(provider.id).toBe('zhipu')
    expect(provider.name).toBe('智谱 AI')
  })

  it('returns first provider when active id not found', () => {
    setConnectionConfig({ activeProviderId: 'nonexistent' })
    const provider = getActiveProvider()
    expect(provider).toBeDefined()
    expect(provider.id).toBe('zhipu')
  })
})

describe('setActiveProvider', () => {
  it('changes the active provider', () => {
    setActiveProvider('openai')
    const provider = getActiveProvider()
    expect(provider.id).toBe('openai')
  })
})

describe('updateProvider', () => {
  it('updates existing provider by id', () => {
    const original = getActiveProvider()
    updateProvider({ ...original, apiKey: 'test-key-123' })
    const updated = getActiveProvider()
    expect(updated.apiKey).toBe('test-key-123')
  })

  it('adds new provider if id does not exist', () => {
    const configBefore = getConnectionConfig()
    const countBefore = configBefore.providers.length
    updateProvider({
      id: 'custom-test',
      name: 'Custom Provider',
      type: 'custom',
      baseUrl: 'http://localhost:8080',
      apiKey: 'key',
      models: ['model-a'],
      defaultModel: 'model-a'
    })
    const configAfter = getConnectionConfig()
    expect(configAfter.providers.length).toBe(countBefore + 1)
    const found = configAfter.providers.find((p) => p.id === 'custom-test')
    expect(found).toBeDefined()
    expect(found?.name).toBe('Custom Provider')
  })
})

describe('removeProvider', () => {
  it('removes a provider by id', () => {
    updateProvider({
      id: 'to-remove',
      name: 'Remove Me',
      type: 'custom',
      baseUrl: 'http://localhost:9999',
      apiKey: '',
      models: [],
      defaultModel: ''
    })
    const configBefore = getConnectionConfig()
    expect(configBefore.providers.some((p) => p.id === 'to-remove')).toBe(true)

    removeProvider('to-remove')
    const configAfter = getConnectionConfig()
    expect(configAfter.providers.some((p) => p.id === 'to-remove')).toBe(false)
  })

  it('falls back to first provider when active provider is removed', () => {
    setActiveProvider('openai')
    removeProvider('openai')
    const config = getConnectionConfig()
    expect(config.activeProviderId).toBe(config.providers[0].id)
  })
})
