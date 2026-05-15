import { describe, it, expect, beforeEach } from 'vitest'
import { useScheduleStore } from '../scheduleStore'

function makeTask(overrides: Record<string, unknown> = {}) {
  return {
    id: `task-${Math.random().toString(36).slice(2, 6)}`,
    name: 'Test Task',
    prompt: 'echo hello',
    intervalSeconds: 60,
    enabled: true,
    lastRunAt: 0,
    nextRunAt: Date.now() + 60000,
    runCount: 0,
    ...overrides,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

describe('scheduleStore', () => {
  beforeEach(() => {
    useScheduleStore.setState({ scheduledTasks: [] })
  })

  describe('addScheduledTask', () => {
    it('adds a task', () => {
      const task = makeTask()
      useScheduleStore.getState().addScheduledTask(task)
      expect(useScheduleStore.getState().scheduledTasks).toHaveLength(1)
      expect(useScheduleStore.getState().scheduledTasks[0].id).toBe(task.id)
    })

    it('appends to existing tasks', () => {
      useScheduleStore.getState().addScheduledTask(makeTask({ name: 'A' }))
      useScheduleStore.getState().addScheduledTask(makeTask({ name: 'B' }))
      expect(useScheduleStore.getState().scheduledTasks).toHaveLength(2)
    })
  })

  describe('updateScheduledTask', () => {
    it('updates a specific task', () => {
      const task = makeTask()
      useScheduleStore.getState().addScheduledTask(task)
      useScheduleStore.getState().updateScheduledTask(task.id, { name: 'Updated' })
      expect(useScheduleStore.getState().scheduledTasks[0].name).toBe('Updated')
    })

    it('does not affect other tasks', () => {
      const t1 = makeTask({ name: 'A' })
      const t2 = makeTask({ name: 'B' })
      useScheduleStore.getState().addScheduledTask(t1)
      useScheduleStore.getState().addScheduledTask(t2)
      useScheduleStore.getState().updateScheduledTask(t1.id, { name: 'Updated' })
      expect(useScheduleStore.getState().scheduledTasks[1].name).toBe('B')
    })

    it('no-ops for non-existent id', () => {
      useScheduleStore.getState().addScheduledTask(makeTask())
      useScheduleStore.getState().updateScheduledTask('nonexistent', { name: 'X' })
      expect(useScheduleStore.getState().scheduledTasks[0].name).not.toBe('X')
    })
  })

  describe('deleteScheduledTask', () => {
    it('removes a task', () => {
      const t1 = makeTask()
      const t2 = makeTask()
      useScheduleStore.getState().addScheduledTask(t1)
      useScheduleStore.getState().addScheduledTask(t2)
      useScheduleStore.getState().deleteScheduledTask(t1.id)
      expect(useScheduleStore.getState().scheduledTasks).toHaveLength(1)
      expect(useScheduleStore.getState().scheduledTasks[0].id).toBe(t2.id)
    })
  })

  describe('tickScheduledTask', () => {
    it('increments runCount and updates timestamps', () => {
      const task = makeTask({ runCount: 0, lastRunAt: 0, intervalSeconds: 60 })
      useScheduleStore.getState().addScheduledTask(task)
      const before = Date.now()
      useScheduleStore.getState().tickScheduledTask(task.id)
      const updated = useScheduleStore.getState().scheduledTasks[0]
      expect(updated.runCount).toBe(1)
      expect(updated.lastRunAt).toBeGreaterThanOrEqual(before)
      expect(updated.nextRunAt).toBeGreaterThanOrEqual(before + 60 * 1000 - 1)
    })

    it('ticks multiple times', () => {
      const task = makeTask({ runCount: 0 })
      useScheduleStore.getState().addScheduledTask(task)
      useScheduleStore.getState().tickScheduledTask(task.id)
      useScheduleStore.getState().tickScheduledTask(task.id)
      useScheduleStore.getState().tickScheduledTask(task.id)
      expect(useScheduleStore.getState().scheduledTasks[0].runCount).toBe(3)
    })
  })
})
