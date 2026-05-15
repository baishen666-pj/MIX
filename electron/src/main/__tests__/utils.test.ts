import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { join } from 'path'
import { readFileSync, writeFileSync, rmSync, mkdirSync } from 'fs'
import { profileHome, safeWriteFile, stripAnsi, readJsonFile, writeJsonFile } from '../utils'

const TMP_DIR = join(__dirname, '__tmp_utils_test__')

beforeEach(() => {
  mkdirSync(TMP_DIR, { recursive: true })
})

afterEach(() => {
  rmSync(TMP_DIR, { recursive: true, force: true })
})

describe('profileHome', () => {
  it('returns APP_HOME for default profile', () => {
    const result = profileHome('default')
    expect(result).not.toContain('profiles')
  })

  it('returns APP_HOME for empty string', () => {
    const result = profileHome('')
    expect(result).not.toContain('profiles')
  })

  it('returns profiles subdirectory for named profile', () => {
    const result = profileHome('work')
    expect(result).toContain('profiles')
    expect(result).toContain('work')
  })
})

describe('safeWriteFile', () => {
  it('writes file creating parent dirs', () => {
    const filePath = join(TMP_DIR, 'sub', 'dir', 'test.txt')
    safeWriteFile(filePath, 'hello')
    expect(readFileSync(filePath, 'utf-8')).toBe('hello')
  })

  it('overwrites existing file', () => {
    const filePath = join(TMP_DIR, 'test.txt')
    safeWriteFile(filePath, 'first')
    safeWriteFile(filePath, 'second')
    expect(readFileSync(filePath, 'utf-8')).toBe('second')
  })
})

describe('stripAnsi', () => {
  it('removes ANSI escape codes', () => {
    expect(stripAnsi('\x1B[31mError\x1B[0m')).toBe('Error')
  })

  it('removes complex ANSI codes', () => {
    expect(stripAnsi('\x1B[1;32;40mOK\x1B[0m')).toBe('OK')
  })

  it('leaves plain text untouched', () => {
    expect(stripAnsi('plain text')).toBe('plain text')
  })

  it('handles empty string', () => {
    expect(stripAnsi('')).toBe('')
  })
})

describe('readJsonFile', () => {
  it('returns fallback when file does not exist', () => {
    const result = readJsonFile(join(TMP_DIR, 'nope.json'), { default: true })
    expect(result).toEqual({ default: true })
  })

  it('reads and parses JSON file', () => {
    const filePath = join(TMP_DIR, 'data.json')
    writeFileSync(filePath, '{"key":"value"}', 'utf-8')
    const result = readJsonFile(filePath, {})
    expect(result).toEqual({ key: 'value' })
  })

  it('returns fallback for invalid JSON', () => {
    const filePath = join(TMP_DIR, 'bad.json')
    writeFileSync(filePath, 'not-json', 'utf-8')
    const result = readJsonFile(filePath, { fallback: true })
    expect(result).toEqual({ fallback: true })
  })
})

describe('writeJsonFile', () => {
  it('writes formatted JSON', () => {
    const filePath = join(TMP_DIR, 'out.json')
    writeJsonFile(filePath, { a: 1 })
    const content = readFileSync(filePath, 'utf-8')
    expect(content).toBe('{\n  "a": 1\n}')
  })

  it('overwrites existing file', () => {
    const filePath = join(TMP_DIR, 'out.json')
    writeJsonFile(filePath, { v: 1 })
    writeJsonFile(filePath, { v: 2 })
    const result = JSON.parse(readFileSync(filePath, 'utf-8'))
    expect(result.v).toBe(2)
  })
})
