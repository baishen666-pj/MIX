import { appendFile } from 'fs/promises'
import { join } from 'path'
import { APP_HOME } from '../utils'
import type { SafetyMode } from './types'

const MAX_ACTIONS_PER_SESSION = 500
const MIN_ACTION_INTERVAL_MS = 200
const MAX_ACTIONS_PER_SECOND = 5

const LOG_FILE = join(APP_HOME, 'computer-use-log.jsonl')

let lastActionTime = 0
let sessionActionCount = 0
let actionTimestamps: number[] = []

export function resetSession(): void {
  lastActionTime = 0
  sessionActionCount = 0
  actionTimestamps = []
}

export function checkRateLimit(): { allowed: boolean; reason?: string } {
  if (sessionActionCount >= MAX_ACTIONS_PER_SESSION) {
    return { allowed: false, reason: `已达到单次会话最大操作数 ${MAX_ACTIONS_PER_SESSION}` }
  }

  const now = Date.now()
  if (now - lastActionTime < MIN_ACTION_INTERVAL_MS) {
    return { allowed: false, reason: `操作间隔不足 ${MIN_ACTION_INTERVAL_MS}ms` }
  }

  const oneSecondAgo = now - 1000
  actionTimestamps = actionTimestamps.filter((t) => t > oneSecondAgo)
  if (actionTimestamps.length >= MAX_ACTIONS_PER_SECOND) {
    return { allowed: false, reason: `每秒最多 ${MAX_ACTIONS_PER_SECOND} 次操作` }
  }

  return { allowed: true }
}

export function recordAction(method: string, params: Record<string, unknown>, safetyMode: SafetyMode, approved: boolean): void {
  lastActionTime = Date.now()
  sessionActionCount++
  actionTimestamps.push(lastActionTime)

  const entry = {
    ts: lastActionTime,
    action: method,
    params,
    safetyMode,
    approved
  }

  appendFile(LOG_FILE, JSON.stringify(entry) + '\n').catch(() => {})
}
