import { join, dirname, isAbsolute, parse as parsePath } from 'path'
import { existsSync, readFileSync } from 'fs'

export interface AgentsConfigResult {
  config: string
  files: string[]
  hasOverride: boolean
}

/**
 * Scan from the filesystem root (or drive root on Windows) to workDir,
 * looking for AGENTS.md and AGENTS.override.md files.
 *
 * Resolution strategy:
 * - Walk from root to workDir, collecting AGENTS.md content.
 * - If an AGENTS.override.md is found at any level, it replaces ALL
 *   collected content from parent directories (override semantics).
 * - After an override, child AGENTS.md files are appended again.
 * - This produces a single merged configuration string.
 */
export function resolveAgentsConfig(workDir: string): AgentsConfigResult {
  if (!isAbsolute(workDir)) {
    workDir = join(process.cwd(), workDir)
  }

  const segments = buildPathSegments(workDir)
  const files: string[] = []
  let contentParts: string[] = []
  let hasOverride = false

  for (const dir of segments) {
    const overridePath = join(dir, 'AGENTS.override.md')
    const agentsPath = join(dir, 'AGENTS.md')

    if (existsSync(overridePath)) {
      // Override replaces all parent-level content
      hasOverride = true
      contentParts = [readFileContent(overridePath)]
      files.length = 0
      files.push(overridePath)
      // Do not also read AGENTS.md at the same level; override takes precedence
      continue
    }

    if (existsSync(agentsPath)) {
      const content = readFileContent(agentsPath)
      if (content) {
        contentParts.push(content)
        files.push(agentsPath)
      }
    }
  }

  return {
    config: contentParts.filter(Boolean).join('\n\n---\n\n'),
    files,
    hasOverride
  }
}

/**
 * Build an array of directory paths from root to the given directory.
 * On Windows, starts from the drive root (e.g., C:\).
 * On Unix, starts from /.
 */
function buildPathSegments(dir: string): string[] {
  const segments: string[] = []
  const parsed = parsePath(dir)
  let current = dir

  // Walk upward until we reach the root
  while (true) {
    segments.push(current)
    const parent = dirname(current)
    if (parent === current) break
    current = parent
  }

  // Reverse so we go root -> target
  return segments.reverse()
}

function readFileContent(filePath: string): string {
  try {
    return readFileSync(filePath, 'utf-8').trim()
  } catch {
    return ''
  }
}
