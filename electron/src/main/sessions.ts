import Database from 'better-sqlite3'
import { join } from 'path'
import { APP_HOME } from './utils'
import { existsSync, mkdirSync } from 'fs'

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (db) return db
  if (!existsSync(APP_HOME)) mkdirSync(APP_HOME, { recursive: true })
  db = new Database(join(APP_HOME, 'state.db'))
  db.pragma('journal_mode = WAL')
  migrate(db)
  return db
}

function migrate(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT 'New Session',
      started_at INTEGER NOT NULL,
      ended_at INTEGER,
      message_count INTEGER NOT NULL DEFAULT 0,
      model TEXT
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
      content,
      content='messages',
      content_rowid='rowid'
    );

    CREATE TRIGGER IF NOT EXISTS messages_ai AFTER INSERT ON messages BEGIN
      INSERT INTO messages_fts(rowid, content) VALUES (new.rowid, new.content);
    END;

    CREATE TRIGGER IF NOT EXISTS messages_ad AFTER DELETE ON messages BEGIN
      INSERT INTO messages_fts(messages_fts, rowid, content) VALUES('delete', old.rowid, old.content);
    END;
  `)
}

export interface SessionRow {
  id: string
  title: string
  started_at: number
  ended_at: number | null
  message_count: number
  model: string | null
}

export interface MessageRow {
  id: string
  session_id: string
  role: string
  content: string
  timestamp: number
}

export function createSession(id: string, model?: string): void {
  getDb().prepare(
    'INSERT INTO sessions (id, started_at, model) VALUES (?, ?, ?)'
  ).run(id, Date.now(), model || null)
}

export function endSession(id: string): void {
  getDb().prepare(
    'UPDATE sessions SET ended_at = ? WHERE id = ?'
  ).run(Date.now(), id)
}

export function updateSessionTitle(id: string, title: string): void {
  getDb().prepare(
    'UPDATE sessions SET title = ? WHERE id = ?'
  ).run(title, id)
}

export function updateMessageCount(sessionId: string): void {
  getDb().prepare(
    'UPDATE sessions SET message_count = (SELECT COUNT(*) FROM messages WHERE session_id = ?) WHERE id = ?'
  ).run(sessionId, sessionId)
}

export function insertMessage(msg: MessageRow): void {
  getDb().prepare(
    'INSERT INTO messages (id, session_id, role, content, timestamp) VALUES (?, ?, ?, ?, ?)'
  ).run(msg.id, msg.session_id, msg.role, msg.content, msg.timestamp)
  updateMessageCount(msg.session_id)
}

export function listSessions(limit = 50): SessionRow[] {
  return getDb().prepare(
    'SELECT * FROM sessions ORDER BY started_at DESC LIMIT ?'
  ).all(limit) as SessionRow[]
}

export function getSessionMessages(sessionId: string): MessageRow[] {
  return getDb().prepare(
    'SELECT * FROM messages WHERE session_id = ? ORDER BY timestamp ASC'
  ).all(sessionId) as MessageRow[]
}

export function deleteSession(id: string): void {
  getDb().prepare('DELETE FROM messages WHERE session_id = ?').run(id)
  getDb().prepare('DELETE FROM sessions WHERE id = ?').run(id)
}

export interface SearchResult {
  session_id: string
  title: string
  snippet: string
}

export function searchSessions(query: string, limit = 20): SearchResult[] {
  const escaped = query.split(/\s+/).map((w) => `"${w.replace(/"/g, '')}"*`).join(' ')
  return getDb().prepare(`
    SELECT DISTINCT m.session_id, s.title,
      snippet(messages_fts, 0, '<<', '>>', '...', 40) as snippet
    FROM messages_fts
    JOIN messages m ON m.id = messages_fts.rowid
    JOIN sessions s ON s.id = m.session_id
    WHERE messages_fts MATCH ?
    ORDER BY rank
    LIMIT ?
  `).all(escaped, limit) as SearchResult[]
}
