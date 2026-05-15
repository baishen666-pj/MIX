import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Note: usePersistence depends on React (useEffect, useRef) and useAppStore.
 * Since @testing-library/react is not available and the vitest environment
 * is 'node' (no jsdom), we mock React hooks and use globalThis for window.
 *
 * useAppStore is used both as a Zustand hook (with selector) and as a store
 * object (.getState, .setState). We mock it as a callable function with
 * getState/setState properties.
 */

// Ensure window is available for source module references
if (typeof globalThis.window === 'undefined') {
  ;(globalThis as Record<string, unknown>).window = globalThis
}

let effectQueue: Array<() => void | (() => void)> = []
let refCallIndex = 0
let refPool: Array<{ current: unknown }> = []

vi.mock('react', () => ({
  useEffect: (fn: () => void | (() => void)) => { effectQueue.push(fn) },
  useRef: <T>(initial: T) => {
    const idx = refCallIndex++
    if (!refPool[idx]) {
      refPool[idx] = { current: initial }
    }
    return refPool[idx] as { current: T }
  },
}))

const mockState: Record<string, unknown> = {
  scheduledTasks: [],
  workflows: [],
}

const setStateMock = vi.fn((patch: Record<string, unknown>) => Object.assign(mockState, patch))

// Mock useAppStore as both a callable hook and an object with static methods
const useAppStoreMock = Object.assign(
  vi.fn((selector: (s: Record<string, unknown>) => unknown) => selector(mockState)),
  {
    getState: () => mockState,
    setState: setStateMock,
    subscribe: vi.fn(() => vi.fn()),
    getInitialState: () => mockState,
  }
)

vi.mock('../../stores/app', () => ({
  useAppStore: useAppStoreMock,
}))

function runEffects() {
  for (const effect of effectQueue) {
    effect()
  }
  effectQueue = []
}

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const sampleTaskRow = {
  id: 't1',
  name: 'Test Task',
  prompt: 'do something',
  interval_seconds: 60,
  enabled: 1,
  last_run_at: 1000,
  next_run_at: 2000,
  run_count: 5,
  created_at: 500,
}

const sampleTaskRowDisabled = {
  ...sampleTaskRow,
  id: 't2',
  enabled: 0,
  last_run_at: null,
  next_run_at: null,
}

const sampleTask = {
  id: 't1',
  name: 'Test Task',
  prompt: 'do something',
  intervalSeconds: 60,
  enabled: true,
  lastRunAt: 1000,
  nextRunAt: 2000,
  runCount: 5,
  createdAt: 500,
}

const sampleWorkflowRow = {
  id: 'w1',
  name: 'My Workflow',
  description: 'desc',
  nodes: JSON.stringify([{ id: 'n1', type: 'start', position: { x: 0, y: 0 }, data: { label: 'Start' } }]),
  edges: JSON.stringify([{ id: 'e1', source: 'n1', target: 'n2' }]),
  created_at: 100,
  updated_at: 200,
}

const sampleWorkflow = {
  id: 'w1',
  name: 'My Workflow',
  description: 'desc',
  nodes: [{ id: 'n1', type: 'start' as const, position: { x: 0, y: 0 }, data: { label: 'Start' } }],
  edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
  createdAt: 100,
  updatedAt: 200,
}

// ---------------------------------------------------------------------------
// Pure conversion function tests
// ---------------------------------------------------------------------------

describe('rowToTask', () => {
  it('converts a TaskRow to ScheduleTask with enabled=true', async () => {
    const { rowToTask } = await import('../usePersistence')
    const result = rowToTask(sampleTaskRow)
    expect(result).toEqual({
      id: 't1',
      name: 'Test Task',
      prompt: 'do something',
      intervalSeconds: 60,
      enabled: true,
      lastRunAt: 1000,
      nextRunAt: 2000,
      runCount: 5,
      createdAt: 500,
    })
  })

  it('converts a TaskRow with enabled=0 to enabled=false', async () => {
    const { rowToTask } = await import('../usePersistence')
    const result = rowToTask(sampleTaskRowDisabled)
    expect(result.enabled).toBe(false)
    expect(result.lastRunAt).toBeNull()
    expect(result.nextRunAt).toBeNull()
  })
})

describe('taskToRow', () => {
  it('converts a ScheduleTask to TaskRow with enabled=1', async () => {
    const { taskToRow } = await import('../usePersistence')
    const result = taskToRow(sampleTask)
    expect(result).toEqual({
      id: 't1',
      name: 'Test Task',
      prompt: 'do something',
      interval_seconds: 60,
      enabled: 1,
      last_run_at: 1000,
      next_run_at: 2000,
      run_count: 5,
      created_at: 500,
    })
  })

  it('converts a disabled ScheduleTask to enabled=0', async () => {
    const { taskToRow } = await import('../usePersistence')
    const disabledTask = { ...sampleTask, enabled: false }
    const result = taskToRow(disabledTask)
    expect(result.enabled).toBe(0)
  })

  it('handles null lastRunAt and nextRunAt', async () => {
    const { taskToRow } = await import('../usePersistence')
    const taskWithNulls = { ...sampleTask, lastRunAt: null, nextRunAt: null }
    const result = taskToRow(taskWithNulls)
    expect(result.last_run_at).toBeNull()
    expect(result.next_run_at).toBeNull()
  })
})

describe('rowToWorkflow', () => {
  it('parses JSON nodes and edges from a WorkflowRow', async () => {
    const { rowToWorkflow } = await import('../usePersistence')
    const result = rowToWorkflow(sampleWorkflowRow)
    expect(result).toEqual(sampleWorkflow)
  })

  it('handles empty nodes and edges arrays', async () => {
    const { rowToWorkflow } = await import('../usePersistence')
    const row = { ...sampleWorkflowRow, nodes: '[]', edges: '[]' }
    const result = rowToWorkflow(row)
    expect(result.nodes).toEqual([])
    expect(result.edges).toEqual([])
  })
})

describe('workflowToRow', () => {
  it('stringifies nodes and edges for a Workflow', async () => {
    const { workflowToRow } = await import('../usePersistence')
    const result = workflowToRow(sampleWorkflow)
    expect(result).toEqual({
      id: 'w1',
      name: 'My Workflow',
      description: 'desc',
      nodes: JSON.stringify(sampleWorkflow.nodes),
      edges: JSON.stringify(sampleWorkflow.edges),
      created_at: 100,
      updated_at: 200,
    })
  })

  it('round-trips through workflowToRow then rowToWorkflow', async () => {
    const { workflowToRow, rowToWorkflow } = await import('../usePersistence')
    const row = workflowToRow(sampleWorkflow)
    const restored = rowToWorkflow(row)
    expect(restored).toEqual(sampleWorkflow)
  })
})

describe('rowToTask / taskToRow round-trip', () => {
  it('round-trips through taskToRow then rowToTask', async () => {
    const { taskToRow, rowToTask } = await import('../usePersistence')
    const row = taskToRow(sampleTask)
    const restored = rowToTask(row)
    expect(restored).toEqual(sampleTask)
  })
})

// ---------------------------------------------------------------------------
// usePersistence hook tests
// ---------------------------------------------------------------------------

describe('usePersistence', () => {
  const getTasks = vi.fn().mockResolvedValue([])
  const getWorkflows = vi.fn().mockResolvedValue([])
  const upsertTask = vi.fn().mockResolvedValue(undefined)
  const deleteTask = vi.fn().mockResolvedValue(undefined)
  const upsertWorkflow = vi.fn().mockResolvedValue(undefined)
  const deleteWorkflow = vi.fn().mockResolvedValue(undefined)

  beforeEach(async () => {
    vi.clearAllMocks()
    mockState.scheduledTasks = []
    mockState.workflows = []
    effectQueue = []
    refCallIndex = 0
    refPool = []

    ;(globalThis as Record<string, unknown>).mixDesktop = {
      persistenceGetTasks: getTasks,
      persistenceGetWorkflows: getWorkflows,
      persistenceUpsertTask: upsertTask,
      persistenceDeleteTask: deleteTask,
      persistenceUpsertWorkflow: upsertWorkflow,
      persistenceDeleteWorkflow: deleteWorkflow,
    }
  })

  it('does nothing when mixDesktop is undefined', async () => {
    ;(globalThis as Record<string, unknown>).mixDesktop = undefined

    const { usePersistence } = await import('../usePersistence')
    usePersistence()
    runEffects()

    expect(getTasks).not.toHaveBeenCalled()
    expect(getWorkflows).not.toHaveBeenCalled()
  })

  it('loads tasks on mount via persistenceGetTasks', async () => {
    const { usePersistence } = await import('../usePersistence')
    usePersistence()
    runEffects()

    expect(getTasks).toHaveBeenCalled()
  })

  it('loads workflows on mount via persistenceGetWorkflows', async () => {
    const { usePersistence } = await import('../usePersistence')
    usePersistence()
    runEffects()

    expect(getWorkflows).toHaveBeenCalled()
  })

  it('handles load errors gracefully', async () => {
    getTasks.mockRejectedValueOnce(new Error('DB error'))
    getWorkflows.mockRejectedValueOnce(new Error('DB error'))

    const { usePersistence } = await import('../usePersistence')
    expect(() => {
      usePersistence()
      runEffects()
    }).not.toThrow()
  })

  it('handles empty task results without error', async () => {
    getTasks.mockResolvedValueOnce([])

    const { usePersistence } = await import('../usePersistence')
    usePersistence()
    runEffects()

    expect(getTasks).toHaveBeenCalled()
  })

  it('handles empty workflow results without error', async () => {
    getWorkflows.mockResolvedValueOnce([])

    const { usePersistence } = await import('../usePersistence')
    usePersistence()
    runEffects()

    expect(getWorkflows).toHaveBeenCalled()
  })

  it('populates scheduledTasks when persistenceGetTasks returns rows', async () => {
    getTasks.mockResolvedValueOnce([sampleTaskRow])

    const { usePersistence } = await import('../usePersistence')
    usePersistence()
    runEffects()

    // Allow the Promise .then callbacks to execute
    await vi.waitFor(() => {
      expect(setStateMock).toHaveBeenCalledWith({ scheduledTasks: [sampleTask] })
    })
  })

  it('does not setState when persistenceGetTasks returns empty array', async () => {
    getTasks.mockResolvedValueOnce([])

    const { usePersistence } = await import('../usePersistence')
    usePersistence()
    runEffects()

    await vi.waitFor(() => {
      expect(getTasks).toHaveBeenCalled()
    })

    // setState should not have been called with scheduledTasks from the load effect
    const taskSetStateCalls = setStateMock.mock.calls.filter(
      (call: unknown[]) => call[0] && 'scheduledTasks' in (call[0] as Record<string, unknown>)
    )
    expect(taskSetStateCalls).toHaveLength(0)
  })

  it('populates workflows when persistenceGetWorkflows returns rows', async () => {
    getWorkflows.mockResolvedValueOnce([sampleWorkflowRow])

    const { usePersistence } = await import('../usePersistence')
    usePersistence()
    runEffects()

    await vi.waitFor(() => {
      expect(setStateMock).toHaveBeenCalledWith({ workflows: [sampleWorkflow] })
    })
  })

  it('does not setState when persistenceGetWorkflows returns empty array', async () => {
    getWorkflows.mockResolvedValueOnce([])

    const { usePersistence } = await import('../usePersistence')
    usePersistence()
    runEffects()

    await vi.waitFor(() => {
      expect(getWorkflows).toHaveBeenCalled()
    })

    const wfSetStateCalls = setStateMock.mock.calls.filter(
      (call: unknown[]) => call[0] && 'workflows' in (call[0] as Record<string, unknown>)
    )
    expect(wfSetStateCalls).toHaveLength(0)
  })

  it('handles persistenceGetTasks rejection gracefully', async () => {
    getTasks.mockRejectedValueOnce(new Error('fail'))

    const { usePersistence } = await import('../usePersistence')
    usePersistence()
    runEffects()

    await vi.waitFor(() => {
      expect(getTasks).toHaveBeenCalled()
    })
    // Should not throw - the catch handler swallows the error
  })

  it('handles persistenceGetWorkflows rejection gracefully', async () => {
    getWorkflows.mockRejectedValueOnce(new Error('fail'))

    const { usePersistence } = await import('../usePersistence')
    usePersistence()
    runEffects()

    await vi.waitFor(() => {
      expect(getWorkflows).toHaveBeenCalled()
    })
  })

  // -------------------------------------------------------------------------
  // Incremental task save diff
  // -------------------------------------------------------------------------

  it('upserts new tasks when tasks change from empty to non-empty', async () => {
    mockState.scheduledTasks = []

    const { usePersistence } = await import('../usePersistence')
    usePersistence()
    runEffects()

    // Now simulate tasks being added to the store
    mockState.scheduledTasks = [sampleTask]

    // Reset refCallIndex so the second usePersistence() call reuses the same refs
    effectQueue = []
    refCallIndex = 0
    const mod = await import('../usePersistence')
    mod.usePersistence()
    runEffects()

    expect(upsertTask).toHaveBeenCalledWith(
      expect.objectContaining({ id: 't1', name: 'Test Task' })
    )
  })

  it('detects deleted tasks and calls persistenceDeleteTask', async () => {
    mockState.scheduledTasks = [sampleTask]

    const { usePersistence } = await import('../usePersistence')
    usePersistence()
    runEffects()

    upsertTask.mockClear()

    mockState.scheduledTasks = []

    effectQueue = []
    refCallIndex = 0
    const mod = await import('../usePersistence')
    mod.usePersistence()
    runEffects()

    expect(deleteTask).toHaveBeenCalledWith('t1')
  })

  it('detects changed tasks and upserts only the changed one', async () => {
    const taskA = { ...sampleTask, id: 'a', name: 'Task A' }
    const taskB = { ...sampleTask, id: 'b', name: 'Task B' }
    mockState.scheduledTasks = [taskA, taskB]

    const { usePersistence } = await import('../usePersistence')
    usePersistence()
    runEffects()

    upsertTask.mockClear()

    const taskAChanged = { ...taskA, name: 'Task A Updated' }
    mockState.scheduledTasks = [taskAChanged, taskB]

    effectQueue = []
    refCallIndex = 0
    const mod = await import('../usePersistence')
    mod.usePersistence()
    runEffects()

    expect(upsertTask).toHaveBeenCalledTimes(1)
    expect(upsertTask).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'a', name: 'Task A Updated' })
    )
  })

  it('does not upsert unchanged tasks', async () => {
    mockState.scheduledTasks = [sampleTask]

    const { usePersistence } = await import('../usePersistence')
    usePersistence()
    runEffects()

    upsertTask.mockClear()

    mockState.scheduledTasks = [{ ...sampleTask }]
    effectQueue = []
    refCallIndex = 0
    const mod = await import('../usePersistence')
    mod.usePersistence()
    runEffects()

    expect(upsertTask).not.toHaveBeenCalled()
    expect(deleteTask).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // Incremental workflow save diff
  // -------------------------------------------------------------------------

  it('upserts new workflows when workflows change from empty to non-empty', async () => {
    mockState.workflows = []

    const { usePersistence } = await import('../usePersistence')
    usePersistence()
    runEffects()

    mockState.workflows = [sampleWorkflow]

    effectQueue = []
    refCallIndex = 0
    const mod = await import('../usePersistence')
    mod.usePersistence()
    runEffects()

    expect(upsertWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'w1', name: 'My Workflow' })
    )
  })

  it('detects deleted workflows and calls persistenceDeleteWorkflow', async () => {
    mockState.workflows = [sampleWorkflow]

    const { usePersistence } = await import('../usePersistence')
    usePersistence()
    runEffects()

    upsertWorkflow.mockClear()

    mockState.workflows = []

    effectQueue = []
    refCallIndex = 0
    const mod = await import('../usePersistence')
    mod.usePersistence()
    runEffects()

    expect(deleteWorkflow).toHaveBeenCalledWith('w1')
  })

  it('detects changed workflows and upserts only the changed one', async () => {
    const wfA = { ...sampleWorkflow, id: 'wa', name: 'WF A' }
    const wfB = { ...sampleWorkflow, id: 'wb', name: 'WF B' }
    mockState.workflows = [wfA, wfB]

    const { usePersistence } = await import('../usePersistence')
    usePersistence()
    runEffects()

    upsertWorkflow.mockClear()

    const wfAChanged = { ...wfA, name: 'WF A Updated' }
    mockState.workflows = [wfAChanged, wfB]

    effectQueue = []
    refCallIndex = 0
    const mod = await import('../usePersistence')
    mod.usePersistence()
    runEffects()

    expect(upsertWorkflow).toHaveBeenCalledTimes(1)
    expect(upsertWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'wa', name: 'WF A Updated' })
    )
  })

  it('does not upsert unchanged workflows', async () => {
    mockState.workflows = [sampleWorkflow]

    const { usePersistence } = await import('../usePersistence')
    usePersistence()
    runEffects()

    upsertWorkflow.mockClear()

    mockState.workflows = [{ ...sampleWorkflow }]
    effectQueue = []
    refCallIndex = 0
    const mod = await import('../usePersistence')
    mod.usePersistence()
    runEffects()

    expect(upsertWorkflow).not.toHaveBeenCalled()
    expect(deleteWorkflow).not.toHaveBeenCalled()
  })

  it('skips task save diff when mixDesktop is undefined', async () => {
    mockState.scheduledTasks = [sampleTask]
    ;(globalThis as Record<string, unknown>).mixDesktop = undefined

    const { usePersistence } = await import('../usePersistence')
    usePersistence()
    runEffects()

    expect(upsertTask).not.toHaveBeenCalled()
    expect(deleteTask).not.toHaveBeenCalled()
  })

  it('skips workflow save diff when mixDesktop is undefined', async () => {
    mockState.workflows = [sampleWorkflow]
    ;(globalThis as Record<string, unknown>).mixDesktop = undefined

    const { usePersistence } = await import('../usePersistence')
    usePersistence()
    runEffects()

    expect(upsertWorkflow).not.toHaveBeenCalled()
    expect(deleteWorkflow).not.toHaveBeenCalled()
  })

  it('handles upsertTask rejection gracefully during incremental save', async () => {
    upsertTask.mockRejectedValueOnce(new Error('write error'))
    mockState.scheduledTasks = [sampleTask]

    const { usePersistence } = await import('../usePersistence')
    expect(() => {
      usePersistence()
      runEffects()
    }).not.toThrow()
  })

  it('handles deleteTask rejection gracefully during incremental save', async () => {
    deleteTask.mockRejectedValueOnce(new Error('delete error'))
    mockState.scheduledTasks = [sampleTask]

    const { usePersistence } = await import('../usePersistence')
    usePersistence()
    runEffects()

    mockState.scheduledTasks = []
    effectQueue = []
    refCallIndex = 0
    const mod = await import('../usePersistence')

    expect(() => {
      mod.usePersistence()
      runEffects()
    }).not.toThrow()
  })

  it('handles upsertWorkflow rejection gracefully during incremental save', async () => {
    upsertWorkflow.mockRejectedValueOnce(new Error('write error'))
    mockState.workflows = [sampleWorkflow]

    const { usePersistence } = await import('../usePersistence')
    expect(() => {
      usePersistence()
      runEffects()
    }).not.toThrow()
  })

  it('handles deleteWorkflow rejection gracefully during incremental save', async () => {
    deleteWorkflow.mockRejectedValueOnce(new Error('delete error'))
    mockState.workflows = [sampleWorkflow]

    const { usePersistence } = await import('../usePersistence')
    usePersistence()
    runEffects()

    mockState.workflows = []
    effectQueue = []
    refCallIndex = 0
    const mod = await import('../usePersistence')

    expect(() => {
      mod.usePersistence()
      runEffects()
    }).not.toThrow()
  })

  it('handles mixed add and delete in single task diff', async () => {
    const taskA = { ...sampleTask, id: 'a', name: 'A' }
    mockState.scheduledTasks = [taskA]

    const { usePersistence } = await import('../usePersistence')
    usePersistence()
    runEffects()

    upsertTask.mockClear()
    deleteTask.mockClear()

    // Remove taskA, add taskB
    const taskB = { ...sampleTask, id: 'b', name: 'B' }
    mockState.scheduledTasks = [taskB]

    effectQueue = []
    refCallIndex = 0
    const mod = await import('../usePersistence')
    mod.usePersistence()
    runEffects()

    expect(deleteTask).toHaveBeenCalledWith('a')
    expect(upsertTask).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'b' })
    )
  })

  it('handles mixed add and delete in single workflow diff', async () => {
    const wfA = { ...sampleWorkflow, id: 'wa', name: 'A' }
    mockState.workflows = [wfA]

    const { usePersistence } = await import('../usePersistence')
    usePersistence()
    runEffects()

    upsertWorkflow.mockClear()
    deleteWorkflow.mockClear()

    const wfB = { ...sampleWorkflow, id: 'wb', name: 'B' }
    mockState.workflows = [wfB]

    effectQueue = []
    refCallIndex = 0
    const mod = await import('../usePersistence')
    mod.usePersistence()
    runEffects()

    expect(deleteWorkflow).toHaveBeenCalledWith('wa')
    expect(upsertWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'wb' })
    )
  })
})
