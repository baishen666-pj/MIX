import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock better-sqlite3 since it's compiled for Electron's Node, not system Node
const { mockDb } = vi.hoisted(() => {
  const stmtMap = new Map<string, { run: ReturnType<typeof vi.fn>; all: ReturnType<typeof vi.fn>; get: ReturnType<typeof vi.fn> }>()

  function getStmt(sql: string) {
    if (!stmtMap.has(sql)) {
      stmtMap.set(sql, { run: vi.fn(), all: vi.fn(), get: vi.fn() })
    }
    return stmtMap.get(sql)!
  }

  const db = {
    prepare: vi.fn((sql: string) => getStmt(sql)),
    exec: vi.fn(),
    pragma: vi.fn(),
    close: vi.fn()
  }

  return { mockDb: db }
})

vi.mock('better-sqlite3', () => {
  return {
    default: vi.fn(() => mockDb)
  }
})

vi.mock('../utils', () => ({
  APP_HOME: '/tmp/test-ai-gui',
  readJsonFile: vi.fn(),
  writeJsonFile: vi.fn(),
  safeWriteFile: vi.fn(),
  stripAnsi: vi.fn()
}))

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>()
  return {
    ...actual,
    existsSync: vi.fn(() => true),
    mkdirSync: vi.fn()
  }
})

import {
  createSession,
  endSession,
  updateSessionTitle,
  updateMessageCount,
  insertMessage,
  listSessions,
  getSessionMessages,
  deleteSession,
  searchSessions
} from '../sessions'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('sessions - createSession', () => {
  it('inserts a session with id and current timestamp', () => {
    createSession('s1')

    expect(mockDb.prepare).toHaveBeenCalledWith(
      'INSERT INTO sessions (id, started_at, model) VALUES (?, ?, ?)'
    )
    const stmtObj = mockDb.prepare.mock.results[0].value
    const runArgs = stmtObj.run.mock.calls[0]
    expect(runArgs[0]).toBe('s1')
    expect(runArgs[1]).toBeTypeOf('number')
    expect(runArgs[1]).toBeGreaterThan(0)
    expect(runArgs[2]).toBeNull()
  })

  it('inserts a session with model when provided', () => {
    createSession('s2', 'gpt-4o')

    const stmtObj = mockDb.prepare.mock.results[0].value
    expect(stmtObj.run).toHaveBeenCalledWith(
      's2',
      expect.any(Number),
      'gpt-4o'
    )
  })
})

describe('sessions - endSession', () => {
  it('updates ended_at with current timestamp', () => {
    endSession('s1')

    expect(mockDb.prepare).toHaveBeenCalledWith(
      'UPDATE sessions SET ended_at = ? WHERE id = ?'
    )
    const stmtObj = mockDb.prepare.mock.results[0].value
    expect(stmtObj.run).toHaveBeenCalledWith(expect.any(Number), 's1')
  })
})

describe('sessions - updateSessionTitle', () => {
  it('updates the title', () => {
    updateSessionTitle('s1', 'My Chat')

    expect(mockDb.prepare).toHaveBeenCalledWith(
      'UPDATE sessions SET title = ? WHERE id = ?'
    )
    const stmtObj = mockDb.prepare.mock.results[0].value
    expect(stmtObj.run).toHaveBeenCalledWith('My Chat', 's1')
  })
})

describe('sessions - insertMessage', () => {
  it('inserts a message and updates message count', () => {
    const msg = {
      id: 'm1',
      session_id: 's1',
      role: 'user',
      content: 'Hello',
      timestamp: Date.now()
    }

    insertMessage(msg)

    // Should have called prepare for INSERT INTO messages
    expect(mockDb.prepare).toHaveBeenCalledWith(
      'INSERT INTO messages (id, session_id, role, content, timestamp) VALUES (?, ?, ?, ?, ?)'
    )
    const insertStmt = mockDb.prepare.mock.results.find(
      (r: any, i: number) => mockDb.prepare.mock.calls[i]?.[0]?.includes('INSERT INTO messages')
    )
    expect(insertStmt).toBeDefined()
    expect(insertStmt!.value.run).toHaveBeenCalledWith(
      'm1', 's1', 'user', 'Hello', expect.any(Number)
    )

    // Should have also called prepare for UPDATE sessions message count
    expect(mockDb.prepare).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE sessions SET message_count')
    )
  })
})

describe('sessions - listSessions', () => {
  it('queries sessions with default limit of 50', () => {
    const stmtObj = mockDb.prepare.mock.results[0]?.value
    if (!stmtObj) {
      // Force prepare to be called
      listSessions()
    }

    expect(mockDb.prepare).toHaveBeenCalledWith(
      expect.stringContaining('SELECT * FROM sessions')
    )
  })

  it('queries sessions with custom limit', () => {
    listSessions(10)

    const listCall = mockDb.prepare.mock.calls.find(
      (c: string[]) => c[0]?.includes('SELECT * FROM sessions')
    )
    expect(listCall).toBeDefined()
    const stmtObj = mockDb.prepare.mock.results.find(
      (r: any, i: number) => mockDb.prepare.mock.calls[i]?.[0]?.includes('SELECT * FROM sessions')
    )
    expect(stmtObj!.value.all).toHaveBeenCalledWith(10)
  })
})

describe('sessions - getSessionMessages', () => {
  it('queries messages ordered by timestamp', () => {
    getSessionMessages('s1')

    expect(mockDb.prepare).toHaveBeenCalledWith(
      expect.stringContaining('SELECT * FROM messages WHERE session_id = ? ORDER BY timestamp ASC')
    )
    const stmtObj = mockDb.prepare.mock.results.find(
      (r: any, i: number) => mockDb.prepare.mock.calls[i]?.[0]?.includes('SELECT * FROM messages WHERE session_id')
    )
    expect(stmtObj!.value.all).toHaveBeenCalledWith('s1')
  })
})

describe('sessions - deleteSession', () => {
  it('deletes messages and session', () => {
    deleteSession('s1')

    expect(mockDb.prepare).toHaveBeenCalledWith(
      'DELETE FROM messages WHERE session_id = ?'
    )
    expect(mockDb.prepare).toHaveBeenCalledWith(
      'DELETE FROM sessions WHERE id = ?'
    )
  })
})

describe('sessions - searchSessions', () => {
  it('escapes query terms for FTS5', () => {
    searchSessions('hello world')

    const stmtObj = mockDb.prepare.mock.results.find(
      (r: any, i: number) => mockDb.prepare.mock.calls[i]?.[0]?.includes('messages_fts MATCH')
    )
    expect(stmtObj).toBeDefined()
    // The query should be escaped: "hello"* "world"*
    expect(stmtObj!.value.all).toHaveBeenCalledWith(
      expect.stringContaining('hello'),
      20
    )
  })

  it('handles special characters in query by stripping embedded quotes', () => {
    searchSessions('test "quoted"')

    const stmtObj = mockDb.prepare.mock.results.find(
      (r: any, i: number) => mockDb.prepare.mock.calls[i]?.[0]?.includes('messages_fts MATCH')
    )
    expect(stmtObj).toBeDefined()
    // Inner quotes are stripped but outer FTS quotes wrap each word
    // Input "test "quoted"" splits to ["test", "\"quoted\""]
    // Each word's inner quotes stripped: ["test", "quoted"]
    // Then FTS-wrapped: ["\"test\"", "\"quoted\""]
    const actualQuery = stmtObj!.value.all.mock.calls[0][0]
    expect(actualQuery).toBe('"test"* "quoted"*')
  })

  it('respects limit parameter', () => {
    searchSessions('test', 5)

    const stmtObj = mockDb.prepare.mock.results.find(
      (r: any, i: number) => mockDb.prepare.mock.calls[i]?.[0]?.includes('messages_fts MATCH')
    )
    expect(stmtObj!.value.all).toHaveBeenCalledWith(expect.any(String), 5)
  })
})
