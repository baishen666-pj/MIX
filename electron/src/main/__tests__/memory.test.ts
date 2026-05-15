import { describe, it, expect, vi, beforeEach } from 'vitest'
import { join } from 'path'

// Use vi.hoisted for values referenced in hoisted vi.mock factories
const { state, MOCK_APP_HOME } = vi.hoisted(() => ({
  state: {
    files: new Map<string, string>(),
    dirs: new Set<string>(),
    writeCalls: [] as Array<{ path: string; content: string }>
  },
  MOCK_APP_HOME: '/tmp/test-ai-gui'
}))

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>()
  return {
    ...actual,
    existsSync: (p: string) => state.files.has(p) || state.dirs.has(p),
    readFileSync: (p: string) => state.files.get(p) ?? '',
    writeFileSync: (p: string, content: string) => {
      state.files.set(p, content)
      state.writeCalls.push({ path: p, content })
    },
    mkdirSync: (p: string) => { state.dirs.add(p) }
  }
})

vi.mock('../utils', () => ({
  APP_HOME: MOCK_APP_HOME
}))

import {
  parseMemoryEntries,
  serializeMemoryEntries,
  readMemory,
  addMemoryEntry,
  updateMemoryEntry,
  removeMemoryEntry,
  readUserProfile,
  writeUserProfile,
  readSoul,
  writeSoul,
  resetSoul,
  MEMORY_MAX_CHARS,
  USER_PROFILE_MAX_CHARS,
  SOUL_MAX_CHARS
} from '../memory'

function np(...segments: string[]): string {
  return join(...segments)
}

const DATA_DIR = np(MOCK_APP_HOME, 'data')
const MEMORY_FILE = np(DATA_DIR, 'MEMORY.md')
const USER_FILE = np(DATA_DIR, 'USER.md')
const SOUL_FILE = np(DATA_DIR, 'SOUL.md')

beforeEach(() => {
  state.files.clear()
  state.dirs.clear()
  state.writeCalls = []
})

describe('parseMemoryEntries', () => {
  it('returns empty array for empty string', () => {
    expect(parseMemoryEntries('')).toEqual([])
    expect(parseMemoryEntries('   ')).toEqual([])
  })

  it('parses a single entry with type', () => {
    const entries = parseMemoryEntries('[fact] hello world')
    expect(entries).toHaveLength(1)
    expect(entries[0].content).toBe('hello world')
    expect(entries[0].type).toBe('fact')
  })

  it('parses multiple entries separated by §', () => {
    const raw = '[fact] first\n§\n[preference] second'
    const entries = parseMemoryEntries(raw)
    expect(entries).toHaveLength(2)
    expect(entries[0].content).toBe('first')
    expect(entries[0].type).toBe('fact')
    expect(entries[1].content).toBe('second')
    expect(entries[1].type).toBe('preference')
  })

  it('defaults to fact type if no bracket prefix', () => {
    const entries = parseMemoryEntries('plain text without type')
    expect(entries).toHaveLength(1)
    expect(entries[0].type).toBe('fact')
    expect(entries[0].content).toBe('plain text without type')
  })

  it('parses all four types', () => {
    const raw = '[fact] a\n§\n[preference] b\n§\n[context] c\n§\n[instruction] d'
    const entries = parseMemoryEntries(raw)
    expect(entries.map((e) => e.type)).toEqual(['fact', 'preference', 'context', 'instruction'])
    expect(entries.map((e) => e.content)).toEqual(['a', 'b', 'c', 'd'])
  })
})

describe('serializeMemoryEntries', () => {
  it('serializes entries with § delimiter and type prefix', () => {
    const entries = [
      { id: 'm1', content: 'hello', timestamp: 1000, type: 'fact' as const },
      { id: 'm2', content: 'world', timestamp: 2000, type: 'preference' as const }
    ]
    const result = serializeMemoryEntries(entries)
    expect(result).toBe('[fact] hello\n§\n[preference] world')
  })

  it('roundtrips through parse and serialize', () => {
    const entries = [
      { id: 'm1', content: 'first', timestamp: 1000, type: 'fact' as const },
      { id: 'm2', content: 'second', timestamp: 2000, type: 'context' as const }
    ]
    const serialized = serializeMemoryEntries(entries)
    const parsed = parseMemoryEntries(serialized)
    expect(parsed.map((e) => ({ content: e.content, type: e.type }))).toEqual([
      { content: 'first', type: 'fact' },
      { content: 'second', type: 'context' }
    ])
  })
})

describe('addMemoryEntry', () => {
  it('creates a new file if none exists', () => {
    const entry = addMemoryEntry({ content: 'new fact', timestamp: Date.now(), type: 'fact' })
    expect(entry.id).toMatch(/^mem-/)
    expect(entry.content).toBe('new fact')
    const paths = state.writeCalls.map((c) => c.path)
    expect(paths.length).toBeGreaterThan(0)
    expect(state.files.get(paths[0])).toContain('[fact] new fact')
  })

  it('prepends to existing entries', () => {
    state.files.set(MEMORY_FILE, '[fact] existing')
    addMemoryEntry({ content: 'new', timestamp: Date.now(), type: 'preference' })
    const written = state.files.get(MEMORY_FILE)
    expect(written).toContain('[preference] new')
    expect(written).toContain('[fact] existing')
  })
})

describe('updateMemoryEntry', () => {
  it('returns false for non-existent id', () => {
    state.files.set(MEMORY_FILE, '[fact] hello')
    const result = updateMemoryEntry('nonexistent', 'updated')
    expect(result).toBe(false)
  })

  it('updates content of existing entry', () => {
    const raw = '[fact] old content'
    state.files.set(MEMORY_FILE, raw)
    const entries = parseMemoryEntries(raw)
    const result = updateMemoryEntry(entries[0].id, 'new content')
    expect(result).toBe(true)
    const written = state.files.get(MEMORY_FILE)
    expect(written).toContain('new content')
  })
})

describe('removeMemoryEntry', () => {
  it('returns false for non-existent id', () => {
    state.files.set(MEMORY_FILE, '[fact] hello')
    const result = removeMemoryEntry('nonexistent')
    expect(result).toBe(false)
  })

  it('removes entry and updates file', () => {
    const raw = '[fact] keep\n§\n[preference] remove'
    state.files.set(MEMORY_FILE, raw)
    const entries = parseMemoryEntries(raw)
    const toRemove = entries.find((e) => e.type === 'preference')!
    const result = removeMemoryEntry(toRemove.id)
    expect(result).toBe(true)
    const written = state.files.get(MEMORY_FILE)
    expect(written).toContain('keep')
    expect(written).not.toContain('remove')
  })
})

describe('readMemory / readUserProfile / readSoul', () => {
  it('returns empty string when file does not exist', () => {
    expect(readMemory()).toBe('')
    expect(readUserProfile()).toBe('')
    expect(readSoul()).toBe('')
  })

  it('returns file content when exists', () => {
    state.files.set(MEMORY_FILE, 'test content')
    expect(readMemory()).toBe('test content')
  })
})

describe('writeUserProfile / writeSoul', () => {
  it('writes content to file', () => {
    writeUserProfile('user profile data')
    expect(state.files.get(USER_FILE)).toBe('user profile data')
  })

  it('clamps to max chars', () => {
    const longContent = 'a'.repeat(5000)
    writeUserProfile(longContent)
    const written = state.files.get(USER_FILE)!
    expect(written.length).toBeLessThanOrEqual(USER_PROFILE_MAX_CHARS)
  })

  it('writes and reads soul', () => {
    writeSoul('soul prompt')
    expect(state.files.get(SOUL_FILE)).toBe('soul prompt')
  })

  it('clamps soul to max chars', () => {
    const longContent = 'b'.repeat(5000)
    writeSoul(longContent)
    const written = state.files.get(SOUL_FILE)!
    expect(written.length).toBeLessThanOrEqual(SOUL_MAX_CHARS)
  })
})

describe('resetSoul', () => {
  it('clears the soul file', () => {
    state.files.set(SOUL_FILE, 'old soul')
    resetSoul()
    expect(state.files.get(SOUL_FILE)).toBe('')
  })
})

describe('MEMORY_MAX_CHARS', () => {
  it('has correct values', () => {
    expect(MEMORY_MAX_CHARS).toBe(2200)
    expect(USER_PROFILE_MAX_CHARS).toBe(1375)
    expect(SOUL_MAX_CHARS).toBe(2000)
  })
})
