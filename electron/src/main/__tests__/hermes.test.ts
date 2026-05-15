import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fs from 'fs'

vi.mock('electron', () => ({
  net: { request: vi.fn() }
}))

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn()
}))

vi.mock('child_process', () => ({
  execFile: vi.fn(),
  spawn: vi.fn()
}))

describe('readHermesApiKey', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.API_SERVER_KEY
  })

  it('returns env var when API_SERVER_KEY is set', async () => {
    process.env.API_SERVER_KEY = 'env-test-key'
    const { readHermesApiKey } = await import('../hermes')
    expect(readHermesApiKey()).toBe('env-test-key')
    delete process.env.API_SERVER_KEY
  })

  it('returns empty string when config.yaml does not exist', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false)
    const { readHermesApiKey } = await import('../hermes')
    expect(readHermesApiKey()).toBe('')
  })

  it('returns empty string when config has no api_server key', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockReturnValue('browser:\n  cdp_url: http://127.0.0.1:9222\n')
    const { readHermesApiKey } = await import('../hermes')
    expect(readHermesApiKey()).toBe('')
  })

  it('reads key from platforms.api_server.extra.key', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockReturnValue(`
browser:
  cdp_url: http://127.0.0.1:9222
platforms:
  api_server:
    enabled: true
    extra:
      port: 8642
      host: "127.0.0.1"
      key: "test-gateway-key"
`)
    const { readHermesApiKey } = await import('../hermes')
    expect(readHermesApiKey()).toBe('test-gateway-key')
  })

  it('returns empty string on malformed YAML', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockReturnValue(':\n  :\n    bad yaml [[[')
    const { readHermesApiKey } = await import('../hermes')
    expect(readHermesApiKey()).toBe('')
  })
})
