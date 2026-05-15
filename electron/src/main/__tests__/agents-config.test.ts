import { describe, it, expect, vi, beforeEach } from 'vitest'
import { join } from 'path'

const { mockFiles, np } = vi.hoisted(() => {
  const mockFiles = new Map<string, string>()
  function np(...segments: string[]): string {
    return join(...segments)
  }
  return { mockFiles, np }
})

vi.mock('fs', () => ({
  existsSync: vi.fn((p: string) => mockFiles.has(p)),
  readFileSync: vi.fn((p: string) => mockFiles.get(p) ?? '')
}))

import { resolveAgentsConfig } from '../agents-config'

beforeEach(() => {
  mockFiles.clear()
})

describe('resolveAgentsConfig', () => {
  it('returns empty config when no AGENTS.md files exist', () => {
    const result = resolveAgentsConfig(np('/home/user/project/src'))
    expect(result.config).toBe('')
    expect(result.files).toEqual([])
    expect(result.hasOverride).toBe(false)
  })

  it('collects AGENTS.md from a single directory', () => {
    mockFiles.set(np('/home/user/project/AGENTS.md'), 'project-level rules')
    const result = resolveAgentsConfig(np('/home/user/project'))
    expect(result.config).toBe('project-level rules')
    expect(result.files).toEqual([np('/home/user/project/AGENTS.md')])
    expect(result.hasOverride).toBe(false)
  })

  it('merges AGENTS.md from multiple directories', () => {
    mockFiles.set(np('/home/user/AGENTS.md'), 'home rules')
    mockFiles.set(np('/home/user/project/AGENTS.md'), 'project rules')
    const result = resolveAgentsConfig(np('/home/user/project'))
    expect(result.config).toContain('home rules')
    expect(result.config).toContain('project rules')
    expect(result.files).toHaveLength(2)
    expect(result.hasOverride).toBe(false)
  })

  it('override replaces all parent content', () => {
    mockFiles.set(np('/home/user/AGENTS.md'), 'home rules')
    mockFiles.set(np('/home/user/project/AGENTS.override.md'), 'override rules')
    const result = resolveAgentsConfig(np('/home/user/project'))
    expect(result.config).toBe('override rules')
    expect(result.files).toEqual([np('/home/user/project/AGENTS.override.md')])
    expect(result.hasOverride).toBe(true)
  })

  it('override at parent level is replaced by child AGENTS.md', () => {
    mockFiles.set(np('/home/user/AGENTS.override.md'), 'parent override')
    mockFiles.set(np('/home/user/project/AGENTS.md'), 'child rules')
    const result = resolveAgentsConfig(np('/home/user/project'))
    expect(result.config).toContain('parent override')
    expect(result.config).toContain('child rules')
    expect(result.hasOverride).toBe(true)
  })

  it('override at same level takes precedence over AGENTS.md', () => {
    mockFiles.set(np('/home/user/project/AGENTS.md'), 'normal rules')
    mockFiles.set(np('/home/user/project/AGENTS.override.md'), 'override rules')
    const result = resolveAgentsConfig(np('/home/user/project'))
    expect(result.config).toBe('override rules')
    expect(result.files).toEqual([np('/home/user/project/AGENTS.override.md')])
    expect(result.hasOverride).toBe(true)
  })

  it('joins multiple sections with delimiter', () => {
    mockFiles.set(np('/home/user/AGENTS.md'), 'section-a')
    mockFiles.set(np('/home/user/project/AGENTS.md'), 'section-b')
    const result = resolveAgentsConfig(np('/home/user/project'))
    expect(result.config).toBe('section-a\n\n---\n\nsection-b')
  })

  it('skips empty files', () => {
    mockFiles.set(np('/home/user/AGENTS.md'), '')
    mockFiles.set(np('/home/user/project/AGENTS.md'), 'content')
    const result = resolveAgentsConfig(np('/home/user/project'))
    expect(result.files).toEqual([np('/home/user/project/AGENTS.md')])
  })
})
