import { join, resolve, relative, sep } from 'path'
import { existsSync, mkdirSync, cpSync, rmSync, readdirSync, statSync, writeFileSync, readFileSync } from 'fs'
import { APP_HOME } from './utils'

export interface CheckpointMeta {
  id: string
  sessionId: string
  description: string
  createdAt: number
  fileCount: number
}

interface CheckpointIndex {
  checkpoints: CheckpointMeta[]
}

const CHECKPOINTS_DIR = join(APP_HOME, 'checkpoints')

function ensureDir(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

function checkpointDir(checkpointId: string): string {
  return join(CHECKPOINTS_DIR, checkpointId)
}

function metaPath(checkpointId: string): string {
  return join(checkpointDir(checkpointId), 'meta.json')
}

function indexPath(sessionId: string): string {
  return join(CHECKPOINTS_DIR, `index-${sessionId}.json`)
}

function readIndex(sessionId: string): CheckpointIndex {
  const file = indexPath(sessionId)
  if (!existsSync(file)) return { checkpoints: [] }
  try {
    return JSON.parse(readFileSync(file, 'utf-8')) as CheckpointIndex
  } catch {
    return { checkpoints: [] }
  }
}

function writeIndex(sessionId: string, index: CheckpointIndex): void {
  ensureDir(CHECKPOINTS_DIR)
  writeFileSync(indexPath(sessionId), JSON.stringify(index, null, 2), 'utf-8')
}

function generateId(): string {
  return `cp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Validate that targetPath is within baseDir, preventing path traversal attacks.
 * Returns the resolved absolute path if valid, throws otherwise.
 */
export function validatePath(baseDir: string, targetPath: string): string {
  const resolvedBase = resolve(baseDir)
  const resolvedTarget = resolve(targetPath)

  if (!resolvedTarget.startsWith(resolvedBase + sep) && resolvedTarget !== resolvedBase) {
    throw new Error(`路径验证失败：目标路径 "${targetPath}" 不在基准目录 "${baseDir}" 内`)
  }

  const rel = relative(resolvedBase, resolvedTarget)
  if (rel.startsWith('..') || rel.includes(`..${sep}`)) {
    throw new Error(`路径验证失败：检测到路径遍历 "${targetPath}"`)
  }

  return resolvedTarget
}

/**
 * Collect all file paths under a directory recursively.
 */
function collectFiles(dir: string, base: string, acc: string[] = []): string[] {
  if (!existsSync(dir)) return acc
  const entries = readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === '.ai-gui') continue
      collectFiles(fullPath, base, acc)
    } else {
      acc.push(relative(base, fullPath))
    }
  }
  return acc
}

/**
 * Create a checkpoint for the given session.
 * Copies the project directory files into a snapshot.
 */
export function createCheckpoint(
  sessionId: string,
  description: string,
  projectDir: string
): CheckpointMeta {
  ensureDir(CHECKPOINTS_DIR)

  const id = generateId()
  const cpDir = checkpointDir(id)
  ensureDir(cpDir)

  const resolvedProject = resolve(projectDir)
  const files = collectFiles(resolvedProject, resolvedProject)

  for (const relPath of files) {
    const src = join(resolvedProject, relPath)
    const dst = join(cpDir, 'files', relPath)
    const dstDir = join(dst, '..')
    ensureDir(dstDir)
    cpSync(src, dst)
  }

  const meta: CheckpointMeta = {
    id,
    sessionId,
    description,
    createdAt: Date.now(),
    fileCount: files.length
  }

  writeFileSync(metaPath(id), JSON.stringify(meta, null, 2), 'utf-8')

  const index = readIndex(sessionId)
  index.checkpoints.unshift(meta)
  writeIndex(sessionId, index)

  return meta
}

/**
 * List all checkpoints for a session, newest first.
 */
export function listCheckpoints(sessionId: string): CheckpointMeta[] {
  const index = readIndex(sessionId)
  return index.checkpoints
}

/**
 * Get a single checkpoint's metadata.
 */
export function getCheckpoint(checkpointId: string): CheckpointMeta | null {
  const file = metaPath(checkpointId)
  if (!existsSync(file)) return null
  try {
    return JSON.parse(readFileSync(file, 'utf-8')) as CheckpointMeta
  } catch {
    return null
  }
}

/**
 * Restore a checkpoint by copying files back to the project directory.
 * Returns the checkpoint metadata if successful, null otherwise.
 */
export function restoreCheckpoint(
  checkpointId: string,
  projectDir: string
): CheckpointMeta | null {
  const meta = getCheckpoint(checkpointId)
  if (!meta) return null

  const filesDir = join(checkpointDir(checkpointId), 'files')
  if (!existsSync(filesDir)) return null

  const resolvedProject = resolve(projectDir)
  const files = collectFiles(filesDir, filesDir)

  for (const relPath of files) {
    const src = join(filesDir, relPath)
    const dst = join(resolvedProject, relPath)

    validatePath(resolvedProject, dst)

    const dstDir = join(dst, '..')
    ensureDir(dstDir)
    cpSync(src, dst, { force: true })
  }

  return meta
}

/**
 * Delete a single checkpoint.
 */
export function deleteCheckpoint(checkpointId: string, sessionId: string): boolean {
  const cpDir = checkpointDir(checkpointId)
  if (!existsSync(cpDir)) return false

  rmSync(cpDir, { recursive: true, force: true })

  const index = readIndex(sessionId)
  index.checkpoints = index.checkpoints.filter((cp) => cp.id !== checkpointId)
  writeIndex(sessionId, index)

  return true
}
