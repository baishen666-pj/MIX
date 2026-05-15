import { useEffect, useRef } from 'react'
import { useAppStore } from '../stores/app'
import type { ScheduleTask, Workflow, WorkflowNode, WorkflowEdge } from '../../../shared/types'

interface TaskRow {
  id: string
  name: string
  prompt: string
  interval_seconds: number
  enabled: number
  last_run_at: number | null
  next_run_at: number | null
  run_count: number
  created_at: number
}

interface WorkflowRow {
  id: string
  name: string
  description: string
  nodes: string
  edges: string
  created_at: number
  updated_at: number
}

export function rowToTask(row: TaskRow): ScheduleTask {
  return {
    id: row.id,
    name: row.name,
    prompt: row.prompt,
    intervalSeconds: row.interval_seconds,
    enabled: row.enabled === 1,
    lastRunAt: row.last_run_at,
    nextRunAt: row.next_run_at,
    runCount: row.run_count,
    createdAt: row.created_at
  }
}

export function taskToRow(task: ScheduleTask): TaskRow {
  return {
    id: task.id,
    name: task.name,
    prompt: task.prompt,
    interval_seconds: task.intervalSeconds,
    enabled: task.enabled ? 1 : 0,
    last_run_at: task.lastRunAt,
    next_run_at: task.nextRunAt,
    run_count: task.runCount,
    created_at: task.createdAt
  }
}

export function rowToWorkflow(row: WorkflowRow): Workflow {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    nodes: JSON.parse(row.nodes) as WorkflowNode[],
    edges: JSON.parse(row.edges) as WorkflowEdge[],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export function workflowToRow(wf: Workflow): WorkflowRow {
  return {
    id: wf.id,
    name: wf.name,
    description: wf.description,
    nodes: JSON.stringify(wf.nodes),
    edges: JSON.stringify(wf.edges),
    created_at: wf.createdAt,
    updated_at: wf.updatedAt
  }
}

export function usePersistence() {
  const loaded = useRef(false)

  // Load on mount
  useEffect(() => {
    if (loaded.current || !window.mixDesktop) return
    loaded.current = true

    // Load tasks
    window.mixDesktop.persistenceGetTasks().then((rows: TaskRow[]) => {
      if (rows && rows.length > 0) {
        const tasks = rows.map(rowToTask)
        useAppStore.setState({ scheduledTasks: tasks })
      }
    }).catch(() => {})

    // Load workflows
    window.mixDesktop.persistenceGetWorkflows().then((rows: WorkflowRow[]) => {
      if (rows && rows.length > 0) {
        const workflows = rows.map(rowToWorkflow)
        useAppStore.setState({ workflows })
      }
    }).catch(() => {})
  }, [])

  // Auto-save tasks on change (incremental)
  const tasks = useAppStore((s) => s.scheduledTasks)
  const prevTasksRef = useRef<Map<string, string>>(new Map())

  useEffect(() => {
    if (!window.mixDesktop) return

    const currentMap = new Map(tasks.map((t) => [t.id, JSON.stringify(taskToRow(t))]))
    const prevMap = prevTasksRef.current

    // Detect deleted tasks
    for (const id of prevMap.keys()) {
      if (!currentMap.has(id)) {
        window.mixDesktop.persistenceDeleteTask(id).catch(() => {})
      }
    }

    // Upsert only changed tasks
    for (const [id, json] of currentMap) {
      if (prevMap.get(id) !== json) {
        window.mixDesktop.persistenceUpsertTask(JSON.parse(json)).catch(() => {})
      }
    }

    prevTasksRef.current = currentMap
  }, [tasks])

  // Auto-save workflows on change (incremental)
  const workflows = useAppStore((s) => s.workflows)
  const prevWfRef = useRef<Map<string, string>>(new Map())

  useEffect(() => {
    if (!window.mixDesktop) return

    const currentMap = new Map(workflows.map((w) => [w.id, JSON.stringify(workflowToRow(w))]))
    const prevMap = prevWfRef.current

    // Detect deleted workflows
    for (const id of prevMap.keys()) {
      if (!currentMap.has(id)) {
        window.mixDesktop.persistenceDeleteWorkflow(id).catch(() => {})
      }
    }

    // Upsert only changed workflows
    for (const [id, json] of currentMap) {
      if (prevMap.get(id) !== json) {
        window.mixDesktop.persistenceUpsertWorkflow(JSON.parse(json)).catch(() => {})
      }
    }

    prevWfRef.current = currentMap
  }, [workflows])
}
