import { spawn, ChildProcess } from 'child_process'
import { join } from 'path'
import { app } from 'electron'
import { existsSync } from 'fs'
import type { JsonRpcRequest, JsonRpcResponse } from './types'

let bridgeProcess: ChildProcess | null = null
let requestIdCounter = 0
const pendingRequests = new Map<number, { resolve: (res: JsonRpcResponse) => void; reject: (err: Error) => void; timeout: NodeJS.Timeout }>()
let heartbeatInterval: NodeJS.Timeout | null = null

function getBridgePaths(): { python: string; script: string } {
  if (app.isPackaged) {
    return {
      python: join(process.resourcesPath, 'python', 'python.exe'),
      script: join(process.resourcesPath, 'python-bridge', 'bridge.py')
    }
  }
  return {
    python: 'python',
    script: join(__dirname, '..', '..', '..', 'python-bridge', 'bridge.py')
  }
}

export async function ensureDependencies(): Promise<void> {
  const { python } = getBridgePaths()
  const sitePackages = app.isPackaged
    ? join(process.resourcesPath, 'python', 'Lib', 'site-packages', 'mss')
    : ''

  if (app.isPackaged && !existsSync(sitePackages)) {
    const { execFile } = await import('child_process')
    const { promisify } = await import('util')
    const execFileAsync = promisify(execFile)
    const reqFile = join(process.resourcesPath, 'python-bridge', 'requirements.txt')
    await execFileAsync(python, ['-m', 'pip', 'install', '-r', reqFile, '--quiet'], { timeout: 120000 })
  }
}

export function startBridge(): void {
  if (bridgeProcess && !bridgeProcess.killed) return

  const { python, script } = getBridgePaths()

  bridgeProcess = spawn(python, [script], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, PYTHONUNBUFFERED: '1' }
  })

  let buffer = ''

  bridgeProcess.stdout!.on('data', (chunk: Buffer) => {
    buffer += chunk.toString('utf-8')
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const response: JsonRpcResponse = JSON.parse(line)
        const pending = pendingRequests.get(response.id)
        if (pending) {
          clearTimeout(pending.timeout)
          pendingRequests.delete(response.id)
          pending.resolve(response)
        }
      } catch {
        // Skip malformed responses
      }
    }
  })

  bridgeProcess.stderr!.on('data', (chunk: Buffer) => {
    // Bridge logs to stderr — ignore or debug log
  })

  bridgeProcess.on('error', (err) => {
    // Reject all pending requests
    for (const [id, pending] of pendingRequests) {
      clearTimeout(pending.timeout)
      pending.reject(err)
    }
    pendingRequests.clear()
    bridgeProcess = null
  })

  bridgeProcess.on('exit', () => {
    for (const [id, pending] of pendingRequests) {
      clearTimeout(pending.timeout)
      pending.reject(new Error('Bridge process exited'))
    }
    pendingRequests.clear()
    bridgeProcess = null
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval)
      heartbeatInterval = null
    }
  })

  // Heartbeat every 30 seconds
  heartbeatInterval = setInterval(() => {
    if (bridgeProcess && !bridgeProcess.killed) {
      sendRequest('ping', {}).catch(() => {})
    }
  }, 30000)
}

export function stopBridge(): void {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval)
    heartbeatInterval = null
  }
  if (bridgeProcess && !bridgeProcess.killed) {
    bridgeProcess.kill()
    bridgeProcess = null
  }
  for (const [id, pending] of pendingRequests) {
    clearTimeout(pending.timeout)
    pending.reject(new Error('Bridge stopped'))
  }
  pendingRequests.clear()
}

export function isRunning(): boolean {
  return bridgeProcess !== null && !bridgeProcess.killed
}

export function sendRequest(method: string, params: Record<string, unknown>): Promise<JsonRpcResponse> {
  return new Promise((resolve, reject) => {
    if (!bridgeProcess || bridgeProcess.killed) {
      reject(new Error('Bridge not running'))
      return
    }

    const id = ++requestIdCounter
    const request: JsonRpcRequest = { id, method, params }

    const timeout = setTimeout(() => {
      pendingRequests.delete(id)
      reject(new Error(`Request timeout: ${method}`))
    }, 30000)

    pendingRequests.set(id, { resolve, reject, timeout })

    try {
      bridgeProcess.stdin!.write(JSON.stringify(request) + '\n')
    } catch (err) {
      clearTimeout(timeout)
      pendingRequests.delete(id)
      reject(err)
    }
  })
}
