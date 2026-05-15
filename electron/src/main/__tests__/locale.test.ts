import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { join } from 'path'
import { mkdirSync, rmSync, writeFileSync } from 'fs'

const { TMP_DIR, LOCALE_FILE, mockSafeWriteFile } = vi.hoisted(() => {
  const path = require('path') as typeof import('path')
  const dir = path.join(__dirname, '__tmp_locale_test__')
  return {
    TMP_DIR: dir,
    LOCALE_FILE: path.join(dir, 'locale'),
    mockSafeWriteFile: vi.fn((filePath: string, content: string): void => {
      const fs = require('fs')
      const p = require('path') as typeof import('path')
      const d = p.join(filePath, '..')
      if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true })
      fs.writeFileSync(filePath, content, 'utf-8')
    })
  }
})

vi.mock('../utils', () => ({
  APP_HOME: TMP_DIR,
  safeWriteFile: mockSafeWriteFile,
  readJsonFile: vi.fn(),
  writeJsonFile: vi.fn(),
  stripAnsi: vi.fn()
}))

// Mock 'fs' readFileSync to redirect locale file reads to our temp dir
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>()
  return {
    ...actual,
    readFileSync: vi.fn(((filePath: string, options?: string | { encoding?: string }) => {
      const enc = typeof options === 'string' ? options : options?.encoding ?? 'utf-8'
      if (typeof filePath === 'string' && filePath.endsWith('locale')) {
        if (!actual.existsSync(LOCALE_FILE)) {
          throw new Error('ENOENT: no such file')
        }
        return actual.readFileSync(LOCALE_FILE, enc as BufferEncoding)
      }
      return actual.readFileSync(filePath, options as BufferEncoding)
    }) as typeof actual.readFileSync)
  }
})

import { getLocale, setLocale } from '../locale'

beforeEach(() => {
  mkdirSync(TMP_DIR, { recursive: true })
})

afterEach(() => {
  rmSync(TMP_DIR, { recursive: true, force: true })
})

describe('getLocale', () => {
  it('returns zh-CN when no locale file exists', () => {
    const locale = getLocale()
    expect(locale).toBe('zh-CN')
  })

  it('returns saved locale from file', () => {
    writeFileSync(LOCALE_FILE, 'en', 'utf-8')
    const locale = getLocale()
    expect(locale).toBe('en')
  })

  it('returns zh-CN for unsupported locale value', () => {
    writeFileSync(LOCALE_FILE, 'fr', 'utf-8')
    const locale = getLocale()
    expect(locale).toBe('zh-CN')
  })

  it('returns zh-CN for empty file', () => {
    writeFileSync(LOCALE_FILE, '', 'utf-8')
    const locale = getLocale()
    expect(locale).toBe('zh-CN')
  })

  it('returns trimmed locale from file', () => {
    writeFileSync(LOCALE_FILE, '  en  ', 'utf-8')
    const locale = getLocale()
    expect(locale).toBe('en')
  })
})

describe('setLocale', () => {
  it('writes locale and returns it', () => {
    const result = setLocale('en')
    expect(result).toBe('en')
  })

  it('writes zh-CN locale', () => {
    const result = setLocale('zh-CN')
    expect(result).toBe('zh-CN')
  })
})
