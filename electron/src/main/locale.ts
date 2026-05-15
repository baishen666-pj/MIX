import { join } from 'path'
import { readFileSync } from 'fs'
import { safeWriteFile } from './utils'
import type { AppLocale } from '../shared/i18n/types'

const LOCALE_FILE = join(process.env.HOME || process.env.USERPROFILE || '.', '.ai-gui', 'locale')

export function getLocale(): AppLocale {
  try {
    const raw = readFileSync(LOCALE_FILE, 'utf-8').trim() as AppLocale
    if (['zh-CN', 'en'].includes(raw)) return raw
  } catch { /* noop */ }
  return 'zh-CN'
}

export function setLocale(locale: AppLocale): AppLocale {
  safeWriteFile(LOCALE_FILE, locale)
  return locale
}
