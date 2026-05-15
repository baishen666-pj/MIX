import type Database from 'better-sqlite3'
import { getDb } from './sessions'

export function migratePersistence(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS scheduled_tasks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      prompt TEXT NOT NULL,
      interval_seconds INTEGER NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      last_run_at INTEGER,
      next_run_at INTEGER,
      run_count INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workflows (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      nodes TEXT NOT NULL DEFAULT '[]',
      edges TEXT NOT NULL DEFAULT '[]',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `)
}

// Initialize migration on import
const db = getDb()
migratePersistence(db)

// --- Scheduled Tasks ---

export interface TaskRow {
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

export function getAllTasks(): TaskRow[] {
  return getDb().prepare('SELECT * FROM scheduled_tasks ORDER BY created_at ASC').all() as TaskRow[]
}

export function upsertTask(task: TaskRow): void {
  getDb().prepare(`
    INSERT INTO scheduled_tasks (id, name, prompt, interval_seconds, enabled, last_run_at, next_run_at, run_count, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name, prompt=excluded.prompt, interval_seconds=excluded.interval_seconds,
      enabled=excluded.enabled, last_run_at=excluded.last_run_at, next_run_at=excluded.next_run_at,
      run_count=excluded.run_count
  `).run(task.id, task.name, task.prompt, task.interval_seconds, task.enabled, task.last_run_at, task.next_run_at, task.run_count, task.created_at)
}

export function deleteTask(id: string): void {
  getDb().prepare('DELETE FROM scheduled_tasks WHERE id = ?').run(id)
}

// --- Workflows ---

export interface WorkflowRow {
  id: string
  name: string
  description: string
  nodes: string
  edges: string
  created_at: number
  updated_at: number
}

export function getAllWorkflows(): WorkflowRow[] {
  return getDb().prepare('SELECT * FROM workflows ORDER BY updated_at DESC').all() as WorkflowRow[]
}

export function upsertWorkflow(wf: WorkflowRow): void {
  getDb().prepare(`
    INSERT INTO workflows (id, name, description, nodes, edges, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name, description=excluded.description, nodes=excluded.nodes,
      edges=excluded.edges, updated_at=excluded.updated_at
  `).run(wf.id, wf.name, wf.description, wf.nodes, wf.edges, wf.created_at, wf.updated_at)
}

export function deleteWorkflow(id: string): void {
  getDb().prepare('DELETE FROM workflows WHERE id = ?').run(id)
}
