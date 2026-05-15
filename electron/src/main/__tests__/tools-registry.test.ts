/**
 * Tests for the tool registry and built-in tools.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { registerTool, unregisterTool, getTool, listToolSpecs, listToolSpecsByLevel, executeTool, clearTools } from '../tools/registry'
import { registerBuiltinTools } from '../tools/index'
import { readFileSpec, readFileHandler, writeFileSpec, writeFileHandler } from '../tools/file-ops'
import { shellSpec, shellHandler } from '../tools/shell'
import { searchSpec } from '../tools/search'
import type { ToolSpec, ToolHandler, ToolResult, ToolContext } from '../tools/types'

const TEST_CTX: ToolContext = {
  workspaceRoot: process.cwd()
}

describe('Tool Registry', () => {
  beforeEach(() => {
    clearTools()
  })

  it('registers and retrieves a tool', () => {
    const spec: ToolSpec = {
      name: 'test.echo',
      description: 'Echo tool',
      inputSchema: { type: 'object' },
      sandboxLevel: 'readonly'
    }
    const handler: ToolHandler = async (args) => ({
      ok: true,
      data: args.message
    })

    registerTool(spec, handler)

    const found = getTool('test.echo')
    expect(found).toBeDefined()
    expect(found?.spec.name).toBe('test.echo')
    expect(found?.spec.description).toBe('Echo tool')
  })

  it('unregisters a tool', () => {
    const spec: ToolSpec = {
      name: 'test.remove',
      description: 'Removable tool',
      inputSchema: { type: 'object' },
      sandboxLevel: 'readonly'
    }
    registerTool(spec, async () => ({ ok: true, data: null }))
    expect(getTool('test.remove')).toBeDefined()

    const removed = unregisterTool('test.remove')
    expect(removed).toBe(true)
    expect(getTool('test.remove')).toBeUndefined()
  })

  it('lists all tool specs', () => {
    registerTool({ name: 'a', description: 'A', inputSchema: {}, sandboxLevel: 'readonly' }, async () => ({ ok: true, data: null }))
    registerTool({ name: 'b', description: 'B', inputSchema: {}, sandboxLevel: 'shell' }, async () => ({ ok: true, data: null }))

    const specs = listToolSpecs()
    expect(specs).toHaveLength(2)
    expect(specs.map((s) => s.name).sort()).toEqual(['a', 'b'])
  })

  it('lists specs filtered by sandbox level', () => {
    registerTool({ name: 'r', description: 'R', inputSchema: {}, sandboxLevel: 'readonly' }, async () => ({ ok: true, data: null }))
    registerTool({ name: 'w', description: 'W', inputSchema: {}, sandboxLevel: 'write' }, async () => ({ ok: true, data: null }))
    registerTool({ name: 's', description: 'S', inputSchema: {}, sandboxLevel: 'shell' }, async () => ({ ok: true, data: null }))
    registerTool({ name: 'n', description: 'N', inputSchema: {}, sandboxLevel: 'network' }, async () => ({ ok: true, data: null }))

    const writeLevel = listToolSpecsByLevel('write')
    expect(writeLevel).toHaveLength(2) // readonly + write
    expect(writeLevel.map((s) => s.name).sort()).toEqual(['r', 'w'])
  })

  it('executes a registered tool', async () => {
    registerTool(
      { name: 'test.add', description: 'Add', inputSchema: {}, sandboxLevel: 'readonly' },
      async (args) => ({ ok: true, data: (args.a as number) + (args.b as number) })
    )

    const result = await executeTool('test.add', { a: 3, b: 4 }, TEST_CTX)
    expect(result.ok).toBe(true)
    expect(result.data).toBe(7)
  })

  it('returns error for missing tool', async () => {
    const result = await executeTool('nonexistent', {}, TEST_CTX)
    expect(result.ok).toBe(false)
    expect(result.error).toContain('not found')
  })

  it('catches handler errors', async () => {
    registerTool(
      { name: 'test.fail', description: 'Fails', inputSchema: {}, sandboxLevel: 'readonly' },
      async () => { throw new Error('boom') }
    )

    const result = await executeTool('test.fail', {}, TEST_CTX)
    expect(result.ok).toBe(false)
    expect(result.error).toBe('boom')
  })

  it('overwrites existing tool on re-register', () => {
    registerTool({ name: 'x', description: 'v1', inputSchema: {}, sandboxLevel: 'readonly' }, async () => ({ ok: true, data: 1 }))
    registerTool({ name: 'x', description: 'v2', inputSchema: {}, sandboxLevel: 'readonly' }, async () => ({ ok: true, data: 2 }))

    const specs = listToolSpecs()
    expect(specs).toHaveLength(1)
    expect(specs[0].description).toBe('v2')
  })
})

describe('registerBuiltinTools', () => {
  beforeEach(() => {
    clearTools()
  })

  it('registers all 4 built-in tools', () => {
    registerBuiltinTools()
    const specs = listToolSpecs()
    expect(specs.length).toBeGreaterThanOrEqual(4)
    const names = specs.map((s) => s.name)
    expect(names).toContain('workspace.readFile')
    expect(names).toContain('workspace.writeFile')
    expect(names).toContain('shell.execute')
    expect(names).toContain('workspace.search')
  })

  it('is idempotent', () => {
    registerBuiltinTools()
    registerBuiltinTools()
    const specs = listToolSpecs()
    // Should not duplicate
    const names = specs.map((s) => s.name)
    const unique = new Set(names)
    expect(unique.size).toBe(names.length)
  })
})

describe('Tool Specs', () => {
  it('file-ops specs have correct sandbox levels', () => {
    expect(readFileSpec.sandboxLevel).toBe('readonly')
    expect(writeFileSpec.sandboxLevel).toBe('write')
  })

  it('shell spec requires shell level', () => {
    expect(shellSpec.sandboxLevel).toBe('shell')
  })

  it('search spec is readonly', () => {
    expect(searchSpec.sandboxLevel).toBe('readonly')
  })

  it('specs are frozen', () => {
    expect(() => { (readFileSpec as { name: string }).name = 'x' }).toThrow()
    expect(() => { (writeFileSpec as { name: string }).name = 'x' }).toThrow()
  })
})

describe('File Operation Tools', () => {
  beforeEach(() => {
    clearTools()
    registerBuiltinTools()
  })

  it('readFile rejects empty path', async () => {
    const result = await readFileHandler({ path: '' }, TEST_CTX)
    expect(result.ok).toBe(false)
    expect(result.error).toContain('required')
  })

  it('readFile rejects path outside workspace', async () => {
    const result = await readFileHandler({ path: '/etc/passwd' }, TEST_CTX)
    expect(result.ok).toBe(false)
    expect(result.error).toContain('outside')
  })

  it('readFile rejects non-existent file', async () => {
    const result = await readFileHandler({ path: 'nonexistent-file-xyz.txt' }, TEST_CTX)
    expect(result.ok).toBe(false)
    expect(result.error).toContain('not found')
  })

  it('writeFile rejects empty path', async () => {
    const result = await writeFileHandler({ path: '', content: 'test' }, TEST_CTX)
    expect(result.ok).toBe(false)
    expect(result.error).toContain('required')
  })

  it('writeFile rejects path outside workspace', async () => {
    const result = await writeFileHandler({ path: '/tmp/test.txt', content: 'test' }, TEST_CTX)
    expect(result.ok).toBe(false)
    expect(result.error).toContain('outside')
  })

  it('writeFile and readFile round-trip', async () => {
    const testPath = '__test_write_read__.txt'
    const writeResult = await writeFileHandler({ path: testPath, content: 'Hello World' }, TEST_CTX)
    expect(writeResult.ok).toBe(true)

    const readResult = await readFileHandler({ path: testPath }, TEST_CTX)
    expect(readResult.ok).toBe(true)
    expect(readResult.data).toBe('Hello World')

    // Cleanup
    const { unlinkSync } = await import('fs')
    unlinkSync(`${TEST_CTX.workspaceRoot}/${testPath}`)
  })
})

describe('Shell Tool', () => {
  it('rejects empty command', async () => {
    const result = await shellHandler({ command: '' }, TEST_CTX)
    expect(result.ok).toBe(false)
    expect(result.error).toContain('required')
  })

  it('rejects disallowed commands', async () => {
    const result = await shellHandler({ command: 'rm -rf /' }, TEST_CTX)
    expect(result.ok).toBe(false)
    expect(result.error).toContain('not allowed')
  })

  it('executes allowed commands', async () => {
    const result = await shellHandler({ command: 'echo hello' }, TEST_CTX)
    expect(result.ok).toBe(true)
    const data = result.data as { stdout: string }
    expect(data.stdout.trim()).toBe('hello')
  })
})
