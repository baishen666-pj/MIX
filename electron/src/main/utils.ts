import { join } from 'path'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'

const APP_HOME = join(process.env.HOME || process.env.USERPROFILE || '.', '.ai-gui')

export { APP_HOME }

export function profileHome(profile?: string): string {
  if (!profile || profile === 'default') return APP_HOME
  return join(APP_HOME, 'profiles', profile)
}

export function safeWriteFile(filePath: string, content: string): void {
  const dir = join(filePath, '..')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(filePath, content, 'utf-8')
}

export function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '')
}

export function readJsonFile<T>(filePath: string, fallback: T): T {
  if (!existsSync(filePath)) return fallback
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8')) as T
  } catch {
    return fallback
  }
}

export function writeJsonFile(filePath: string, data: unknown): void {
  safeWriteFile(filePath, JSON.stringify(data, null, 2))
}
