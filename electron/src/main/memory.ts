import { join } from 'path'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { APP_HOME } from './utils'

export const MEMORY_MAX_CHARS = 2200
export const USER_PROFILE_MAX_CHARS = 1375
export const SOUL_MAX_CHARS = 2000

const SECTION_DELIMITER = '§'

export interface MemoryEntry {
  id: string
  content: string
  timestamp: number
  type: 'fact' | 'preference' | 'context' | 'instruction'
}

export interface UserProfile {
  content: string
  updatedAt: number
}

function ensureDataDir(profile?: string): string {
  const base = profile && profile !== 'default'
    ? join(APP_HOME, 'profiles', profile)
    : APP_HOME
  const dataDir = join(base, 'data')
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true })
  return dataDir
}

function readTextFile(filePath: string): string {
  if (!existsSync(filePath)) return ''
  try {
    return readFileSync(filePath, 'utf-8')
  } catch {
    return ''
  }
}

function writeTextFile(filePath: string, content: string): void {
  const dir = join(filePath, '..')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(filePath, content, 'utf-8')
}

// --- MEMORY.md ---

function memoryFilePath(profile?: string): string {
  return join(ensureDataDir(profile), 'MEMORY.md')
}

export function readMemory(profile?: string): string {
  return readTextFile(memoryFilePath(profile))
}

export function parseMemoryEntries(raw: string): MemoryEntry[] {
  if (!raw.trim()) return []
  const sections = raw.split(SECTION_DELIMITER).filter((s) => s.trim())
  return sections.map((section, index) => {
    const lines = section.trim().split('\n')
    const firstLine = lines[0].trim()
    // Parse type from first line like "[fact] content" or just "content"
    const typeMatch = firstLine.match(/^\[(fact|preference|context|instruction)\]\s*(.*)/)
    const type: MemoryEntry['type'] = typeMatch
      ? (typeMatch[1] as MemoryEntry['type'])
      : 'fact'
    const content = typeMatch
      ? typeMatch[2] + (lines.length > 1 ? '\n' + lines.slice(1).join('\n') : '')
      : section.trim()
    return {
      id: `mem-${index}`,
      content: content.trim(),
      timestamp: Date.now() - (sections.length - index) * 1000,
      type
    }
  })
}

export function serializeMemoryEntries(entries: MemoryEntry[]): string {
  return entries
    .map((e) => `[${e.type}] ${e.content}`)
    .join(`\n${SECTION_DELIMITER}\n`)
}

export function addMemoryEntry(entry: Omit<MemoryEntry, 'id'>, profile?: string): MemoryEntry {
  const raw = readMemory(profile)
  const entries = parseMemoryEntries(raw)
  const newEntry: MemoryEntry = {
    ...entry,
    id: `mem-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
  }
  const updated = [newEntry, ...entries]
  const serialized = serializeMemoryEntries(updated)
  const clamped = serialized.slice(0, MEMORY_MAX_CHARS)
  writeTextFile(memoryFilePath(profile), clamped)
  return newEntry
}

export function updateMemoryEntry(id: string, content: string, profile?: string): boolean {
  const raw = readMemory(profile)
  const entries = parseMemoryEntries(raw)
  const index = entries.findIndex((e) => e.id === id)
  if (index === -1) return false
  entries[index] = { ...entries[index], content }
  const serialized = serializeMemoryEntries(entries)
  const clamped = serialized.slice(0, MEMORY_MAX_CHARS)
  writeTextFile(memoryFilePath(profile), clamped)
  return true
}

export function removeMemoryEntry(id: string, profile?: string): boolean {
  const raw = readMemory(profile)
  const entries = parseMemoryEntries(raw)
  const filtered = entries.filter((e) => e.id !== id)
  if (filtered.length === entries.length) return false
  const serialized = serializeMemoryEntries(filtered)
  writeTextFile(memoryFilePath(profile), serialized)
  return true
}

// --- USER.md ---

function userProfilePath(profile?: string): string {
  return join(ensureDataDir(profile), 'USER.md')
}

export function readUserProfile(profile?: string): string {
  return readTextFile(userProfilePath(profile))
}

export function writeUserProfile(content: string, profile?: string): void {
  const clamped = content.slice(0, USER_PROFILE_MAX_CHARS)
  writeTextFile(userProfilePath(profile), clamped)
}

// --- SOUL.md ---

function soulFilePath(profile?: string): string {
  return join(ensureDataDir(profile), 'SOUL.md')
}

export function readSoul(profile?: string): string {
  return readTextFile(soulFilePath(profile))
}

export function writeSoul(content: string, profile?: string): void {
  const clamped = content.slice(0, SOUL_MAX_CHARS)
  writeTextFile(soulFilePath(profile), clamped)
}

export function resetSoul(profile?: string): void {
  writeTextFile(soulFilePath(profile), '')
}
