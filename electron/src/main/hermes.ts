import { join } from 'path'
import { existsSync, readFileSync } from 'fs'
import { execFile, spawn } from 'child_process'
import { net } from 'electron'
import * as yaml from 'js-yaml'

const HERMES_HOME = process.env.HERMES_HOME ||
  join(process.env.LOCALAPPDATA || join(process.env.USERPROFILE || '.', 'AppData', 'Local'), 'hermes')
const HERMES_CLI = join(HERMES_HOME, 'hermes-agent', 'venv', 'Scripts', 'hermes')
const GATEWAY_BASE = 'http://127.0.0.1:8642'

export function readHermesApiKey(): string {
  const envKey = process.env.API_SERVER_KEY || ''
  if (envKey) return envKey

  const configPath = join(HERMES_HOME, 'config.yaml')
  if (!existsSync(configPath)) return ''

  try {
    const content = readFileSync(configPath, 'utf-8')
    const config = yaml.load(content) as Record<string, unknown> | undefined
    const platforms = config?.platforms as Record<string, unknown> | undefined
    const apiServer = platforms?.api_server as Record<string, unknown> | undefined
    const extra = apiServer?.extra as Record<string, unknown> | undefined
    const key = extra?.key
    return typeof key === 'string' ? key : ''
  } catch {
    return ''
  }
}

export function checkGatewayHealth(): Promise<{ ok: boolean; platform: string }> {
  return new Promise((resolve) => {
    const url = `${GATEWAY_BASE}/health`
    const request = net.request({ method: 'GET', url })
    const timeout = setTimeout(() => {
      request.abort()
      resolve({ ok: false, platform: '' })
    }, 5000)

    request.on('response', (response) => {
      clearTimeout(timeout)
      if (response.statusCode !== 200) {
        resolve({ ok: false, platform: '' })
        return
      }
      let body = ''
      response.on('data', (chunk: Buffer) => { body += chunk.toString() })
      response.on('end', () => {
        try {
          const parsed = JSON.parse(body)
          resolve({ ok: parsed.status === 'ok', platform: parsed.platform || '' })
        } catch {
          resolve({ ok: false, platform: '' })
        }
      })
    })
    request.on('error', () => {
      clearTimeout(timeout)
      resolve({ ok: false, platform: '' })
    })
    request.end()
  })
}

function isCliAvailable(): boolean {
  return existsSync(HERMES_CLI)
}

function pollHealth(maxAttempts: number, intervalMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    let attempts = 0
    const poll = (): void => {
      attempts++
      checkGatewayHealth().then(({ ok }) => {
        if (ok) { resolve(true); return }
        if (attempts >= maxAttempts) { resolve(false); return }
        setTimeout(poll, intervalMs)
      })
    }
    poll()
  })
}

export async function startGateway(): Promise<boolean> {
  if (!isCliAvailable()) return false
  const { ok } = await checkGatewayHealth()
  if (ok) return true

  return new Promise((resolve) => {
    const proc = spawn(HERMES_CLI, ['gateway', 'run'], {
      detached: true,
      stdio: 'ignore',
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
    })
    proc.unref()
    proc.on('error', () => resolve(false))
    pollHealth(15, 1000).then(resolve)
  })
}

export async function stopGateway(): Promise<boolean> {
  if (!isCliAvailable()) return false
  return new Promise((resolve) => {
    execFile(HERMES_CLI, ['gateway', 'stop'], {
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
      timeout: 10000
    }, (err) => {
      if (err) {
        resolve(false)
        return
      }
      pollHealth(5, 500).then((stillOk) => resolve(!stillOk))
    })
  })
}

export async function getGatewayStatus(): Promise<{
  running: boolean
  apiKeyConfigured: boolean
  cliAvailable: boolean
}> {
  const { ok } = await checkGatewayHealth()
  return {
    running: ok,
    apiKeyConfigured: readHermesApiKey().length > 0,
    cliAvailable: isCliAvailable()
  }
}
