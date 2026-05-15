/**
 * Tests for the search tool (workspace.search).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { normalize } from 'path'
import { searchSpec, searchHandler } from '../tools/search'
import type { ToolContext } from '../tools/types'

vi.mock('child_process', () => ({
  execFile: vi.fn()
}))

import { execFile } from 'child_process'

const mockedExecFile = vi.mocked(execFile)

const WORKSPACE_ROOT = '/test'
const NORMALIZED_ROOT = normalize(WORKSPACE_ROOT)

const TEST_CTX: ToolContext = {
  workspaceRoot: WORKSPACE_ROOT
}

describe('searchSpec', () => {
  it('has correct name and required fields', () => {
    expect(searchSpec.name).toBe('workspace.search')
    expect(searchSpec.description).toBeTruthy()
    expect(searchSpec.inputSchema.type).toBe('object')
    expect(searchSpec.sandboxLevel).toBe('readonly')
    expect(searchSpec.inputSchema).toHaveProperty('properties')
    expect(searchSpec.inputSchema).toHaveProperty('required')
    const required = searchSpec.inputSchema.required as string[]
    expect(required).toContain('pattern')
  })
})

describe('searchHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns ok: false when pattern is empty', async () => {
    const result = await searchHandler({ pattern: '' }, TEST_CTX)
    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('returns ok: false when pattern is missing', async () => {
    const result = await searchHandler({}, TEST_CTX)
    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('parses grep output with results correctly', async () => {
    const output = [
      `${NORMALIZED_ROOT}/src/main.ts:10:import path`,
      `${NORMALIZED_ROOT}/src/utils.ts:25:export function helper`
    ].join('\n')

    mockedExecFile.mockImplementation((_cmd, _args, _opts, cb) => {
      cb!(null, output, '')
      return {} as any
    })

    const result = await searchHandler({ pattern: 'import' }, TEST_CTX)

    expect(result.ok).toBe(true)
    const data = result.data as { matches: Array<{ file: string; line: number; text: string }>; total: number }
    expect(data.total).toBe(2)
    expect(data.matches[0]).toEqual({ file: 'src/main.ts', line: 10, text: 'import path' })
    expect(data.matches[1]).toEqual({ file: 'src/utils.ts', line: 25, text: 'export function helper' })
  })

  it('returns empty matches when grep finds nothing (exit code 1)', async () => {
    const error = Object.assign(new Error('no match'), { code: 1 })
    mockedExecFile.mockImplementation((_cmd, _args, _opts, cb) => {
      cb!(error, '', '')
      return {} as any
    })

    const result = await searchHandler({ pattern: 'nonexistent' }, TEST_CTX)

    expect(result.ok).toBe(true)
    const data = result.data as { matches: unknown[]; total: number }
    expect(data.matches).toEqual([])
    expect(data.total).toBe(0)
  })

  it('returns ok: false on grep execution error (code != 1)', async () => {
    const error = Object.assign(new Error('grep failed'), { code: 2 })
    mockedExecFile.mockImplementation((_cmd, _args, _opts, cb) => {
      cb!(error, '', 'binary file matches')
      return {} as any
    })

    const result = await searchHandler({ pattern: 'test' }, TEST_CTX)

    expect(result.ok).toBe(false)
    expect(result.error).toContain('grep failed')
  })

  it('defaults maxResults to 50', async () => {
    let capturedArgs: string[] = []
    mockedExecFile.mockImplementation((_cmd, args, _opts, cb) => {
      capturedArgs = args as string[]
      cb!(null, '', '')
      return {} as any
    })

    await searchHandler({ pattern: 'test' }, TEST_CTX)

    const maxCountArg = capturedArgs.find((a) => a.startsWith('--max-count='))
    expect(maxCountArg).toBe('--max-count=50')
  })

  it('caps maxResults at 200', async () => {
    let capturedArgs: string[] = []
    mockedExecFile.mockImplementation((_cmd, args, _opts, cb) => {
      capturedArgs = args as string[]
      cb!(null, '', '')
      return {} as any
    })

    await searchHandler({ pattern: 'test', maxResults: 500 }, TEST_CTX)

    const maxCountArg = capturedArgs.find((a) => a.startsWith('--max-count='))
    expect(maxCountArg).toBe('--max-count=200')
  })

  it('passes custom maxResults when within range', async () => {
    let capturedArgs: string[] = []
    mockedExecFile.mockImplementation((_cmd, args, _opts, cb) => {
      capturedArgs = args as string[]
      cb!(null, '', '')
      return {} as any
    })

    await searchHandler({ pattern: 'test', maxResults: 10 }, TEST_CTX)

    const maxCountArg = capturedArgs.find((a) => a.startsWith('--max-count='))
    expect(maxCountArg).toBe('--max-count=10')
  })

  it('adds --include flag when glob is specified', async () => {
    let capturedArgs: string[] = []
    mockedExecFile.mockImplementation((_cmd, args, _opts, cb) => {
      capturedArgs = args as string[]
      cb!(null, '', '')
      return {} as any
    })

    await searchHandler({ pattern: 'test', glob: '*.ts' }, TEST_CTX)

    expect(capturedArgs).toContain('--include=*.ts')
  })

  it('does not add --include flag when glob is omitted', async () => {
    let capturedArgs: string[] = []
    mockedExecFile.mockImplementation((_cmd, args, _opts, cb) => {
      capturedArgs = args as string[]
      cb!(null, '', '')
      return {} as any
    })

    await searchHandler({ pattern: 'test' }, TEST_CTX)

    const includeArg = capturedArgs.find((a) => a.startsWith('--include='))
    expect(includeArg).toBeUndefined()
  })

  it('strips root prefix from file paths in results', async () => {
    const output = `${NORMALIZED_ROOT}/src/app.ts:5:const x = 1`

    mockedExecFile.mockImplementation((_cmd, _args, _opts, cb) => {
      cb!(null, output, '')
      return {} as any
    })

    const result = await searchHandler({ pattern: 'const' }, TEST_CTX)

    expect(result.ok).toBe(true)
    const data = result.data as { matches: Array<{ file: string }> }
    expect(data.matches[0].file).toBe('src/app.ts')
  })
})
