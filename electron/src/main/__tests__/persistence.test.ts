import { describe, it, expect, vi, beforeEach } from 'vitest'

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

vi.mock('better-sqlite3', () => ({
  default: vi.fn(() => mockDb)
}))

vi.mock('./sessions', () => ({
  getDb: vi.fn(() => mockDb)
}))

vi.mock('./utils', () => ({
  APP_HOME: '/tmp/test-ai-gui',
  readJsonFile: vi.fn(),
  writeJsonFile: vi.fn(),
  safeWriteFile: vi.fn(),
  stripAnsi: vi.fn()
}))

// Must import after mocks are set up
// Note: persistence.ts calls getDb() at module level, so the mock must be ready
import {
  getAllTasks,
  upsertTask,
  deleteTask,
  getAllWorkflows,
  upsertWorkflow,
  deleteWorkflow
} from '../persistence'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('scheduled tasks - upsertTask', () => {
  const baseTask = {
    id: 't1',
    name: 'Daily Summary',
    prompt: 'Summarize today',
    interval_seconds: 86400,
    enabled: 1,
    last_run_at: null,
    next_run_at: null,
    run_count: 0,
    created_at: Date.now()
  }

  it('inserts a new task', () => {
    upsertTask(baseTask)

    expect(mockDb.prepare).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO scheduled_tasks')
    )
    const stmtObj = mockDb.prepare.mock.results.find(
      (r: any, i: number) => mockDb.prepare.mock.calls[i]?.[0]?.includes('INSERT INTO scheduled_tasks')
    )
    expect(stmtObj).toBeDefined()
    expect(stmtObj!.value.run).toHaveBeenCalledWith(
      't1', 'Daily Summary', 'Summarize today', 86400, 1, null, null, 0, expect.any(Number)
    )
  })

  it('upserts with ON CONFLICT DO UPDATE', () => {
    upsertTask(baseTask)

    expect(mockDb.prepare).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT(id) DO UPDATE SET')
    )
  })

  it('passes all fields to the statement', () => {
    const task = {
      ...baseTask,
      id: 't2',
      name: 'Updated',
      enabled: 0,
      run_count: 10,
      last_run_at: 1000,
      next_run_at: 2000
    }
    upsertTask(task)

    const stmtObj = mockDb.prepare.mock.results.find(
      (r: any, i: number) => mockDb.prepare.mock.calls[i]?.[0]?.includes('INSERT INTO scheduled_tasks')
    )
    expect(stmtObj!.value.run).toHaveBeenCalledWith(
      't2', 'Updated', 'Summarize today', 86400, 0, 1000, 2000, 10, expect.any(Number)
    )
  })
})

describe('scheduled tasks - getAllTasks', () => {
  it('queries all tasks ordered by created_at', () => {
    getAllTasks()

    expect(mockDb.prepare).toHaveBeenCalledWith(
      'SELECT * FROM scheduled_tasks ORDER BY created_at ASC'
    )
    const stmtObj = mockDb.prepare.mock.results[0]?.value
    expect(stmtObj?.all).toHaveBeenCalled()
  })
})

describe('scheduled tasks - deleteTask', () => {
  it('deletes a task by id', () => {
    deleteTask('t1')

    expect(mockDb.prepare).toHaveBeenCalledWith(
      'DELETE FROM scheduled_tasks WHERE id = ?'
    )
    const stmtObj = mockDb.prepare.mock.results.find(
      (r: any, i: number) => mockDb.prepare.mock.calls[i]?.[0]?.includes('DELETE FROM scheduled_tasks')
    )
    expect(stmtObj!.value.run).toHaveBeenCalledWith('t1')
  })
})

describe('workflows - upsertWorkflow', () => {
  const baseWorkflow = {
    id: 'wf1',
    name: 'Research Flow',
    description: 'Deep research',
    nodes: JSON.stringify([{ id: 'n1', type: 'start' }]),
    edges: '[]',
    created_at: Date.now(),
    updated_at: Date.now()
  }

  it('inserts a new workflow', () => {
    upsertWorkflow(baseWorkflow)

    expect(mockDb.prepare).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO workflows')
    )
    const stmtObj = mockDb.prepare.mock.results.find(
      (r: any, i: number) => mockDb.prepare.mock.calls[i]?.[0]?.includes('INSERT INTO workflows')
    )
    expect(stmtObj).toBeDefined()
    expect(stmtObj!.value.run).toHaveBeenCalledWith(
      'wf1', 'Research Flow', 'Deep research',
      expect.stringContaining('n1'), '[]',
      expect.any(Number), expect.any(Number)
    )
  })

  it('upserts with ON CONFLICT DO UPDATE', () => {
    upsertWorkflow(baseWorkflow)

    expect(mockDb.prepare).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT(id) DO UPDATE SET')
    )
  })

  it('updates all fields on conflict', () => {
    const updated = {
      ...baseWorkflow,
      name: 'Updated Flow',
      description: 'V2',
      updated_at: Date.now() + 1000
    }
    upsertWorkflow(updated)

    const stmtObj = mockDb.prepare.mock.results.find(
      (r: any, i: number) => mockDb.prepare.mock.calls[i]?.[0]?.includes('INSERT INTO workflows')
    )
    expect(stmtObj!.value.run).toHaveBeenCalledWith(
      'wf1', 'Updated Flow', 'V2',
      expect.any(String), '[]',
      expect.any(Number), expect.any(Number)
    )
  })
})

describe('workflows - getAllWorkflows', () => {
  it('queries workflows ordered by updated_at desc', () => {
    getAllWorkflows()

    expect(mockDb.prepare).toHaveBeenCalledWith(
      'SELECT * FROM workflows ORDER BY updated_at DESC'
    )
    const stmtObj = mockDb.prepare.mock.results[0]?.value
    expect(stmtObj?.all).toHaveBeenCalled()
  })
})

describe('workflows - deleteWorkflow', () => {
  it('deletes a workflow by id', () => {
    deleteWorkflow('wf1')

    expect(mockDb.prepare).toHaveBeenCalledWith(
      'DELETE FROM workflows WHERE id = ?'
    )
    const stmtObj = mockDb.prepare.mock.results.find(
      (r: any, i: number) => mockDb.prepare.mock.calls[i]?.[0]?.includes('DELETE FROM workflows')
    )
    expect(stmtObj!.value.run).toHaveBeenCalledWith('wf1')
  })
})
