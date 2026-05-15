/**
 * Tests for the MCP server module.
 * Tests server lifecycle without actually starting stdio transport.
 * Mocks persistence to avoid better-sqlite3 native module issues.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock persistence before importing MCP server
vi.mock('../persistence', () => ({
  migratePersistence: vi.fn(),
  getAllTasks: vi.fn(() => []),
  getAllWorkflows: vi.fn(() => []),
  upsertTask: vi.fn(),
  deleteTask: vi.fn(),
  upsertWorkflow: vi.fn(),
  deleteWorkflow: vi.fn()
}))

// Mock sessions to avoid native sqlite module
vi.mock('../sessions', () => ({
  getDb: vi.fn(),
  listSessions: vi.fn(() => []),
  getSessionMessages: vi.fn(() => []),
  createSession: vi.fn(),
  endSession: vi.fn(),
  updateSessionTitle: vi.fn(),
  deleteSession: vi.fn(),
  insertMessage: vi.fn(),
  searchSessions: vi.fn(() => [])
}))

// Mock chat to avoid network calls
vi.mock('../chat', () => ({
  sendMessage: vi.fn(() => new AbortController())
}))

import { getMcpServer, createMcpServer, stopMcpServer } from '../mcp/server'

describe('MCP Server', () => {
  beforeEach(async () => {
    await stopMcpServer()
  })

  it('getMcpServer returns null before creation', async () => {
    await stopMcpServer()
    expect(getMcpServer()).toBeNull()
  })

  it('createMcpServer creates server state with expected interface', async () => {
    const state = createMcpServer()
    expect(state).toBeDefined()
    expect(state.server).toBeDefined()
    expect(state.transport).toBeDefined()
    expect(typeof state.start).toBe('function')
    expect(typeof state.stop).toBe('function')

    // Clean up without starting
    await state.stop()
  })

  it('stopMcpServer is safe to call when no server exists', async () => {
    await stopMcpServer()
    // Should not throw
    await stopMcpServer()
  })
})
