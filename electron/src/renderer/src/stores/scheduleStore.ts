import { create } from 'zustand'
import type { ScheduleTask } from '../../../shared/types'

interface ScheduleState {
  scheduledTasks: ScheduleTask[]
  addScheduledTask: (task: ScheduleTask) => void
  updateScheduledTask: (id: string, patch: Partial<ScheduleTask>) => void
  deleteScheduledTask: (id: string) => void
  tickScheduledTask: (id: string) => void
}

export const useScheduleStore = create<ScheduleState>((set) => ({
  scheduledTasks: [],

  addScheduledTask: (task) =>
    set((s) => ({ scheduledTasks: [...s.scheduledTasks, task] })),

  updateScheduledTask: (id, patch) =>
    set((s) => ({
      scheduledTasks: s.scheduledTasks.map((t) =>
        t.id === id ? { ...t, ...patch } : t
      )
    })),

  deleteScheduledTask: (id) =>
    set((s) => ({
      scheduledTasks: s.scheduledTasks.filter((t) => t.id !== id)
    })),

  tickScheduledTask: (id) =>
    set((s) => ({
      scheduledTasks: s.scheduledTasks.map((t) =>
        t.id === id
          ? {
              ...t,
              lastRunAt: Date.now(),
              nextRunAt: Date.now() + t.intervalSeconds * 1000,
              runCount: t.runCount + 1
            }
          : t
      )
    }))
}))
