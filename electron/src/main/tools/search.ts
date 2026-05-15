/**
 * Search tool — searches workspace files using grep-like pattern matching.
 */

import { execFile } from 'child_process'
import { join, normalize } from 'path'
import type { ToolSpec, ToolHandler, ToolResult } from './types'

export const searchSpec: ToolSpec = Object.freeze({
  name: 'workspace.search',
  description: 'Search for a text pattern across files in the workspace. Returns matching file paths and lines.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      pattern: { type: 'string', description: 'The text pattern to search for.' },
      glob: { type: 'string', description: 'Optional file glob filter, e.g. "*.ts".' },
      maxResults: { type: 'number', description: 'Maximum results to return (default 50).' }
    },
    required: ['pattern']
  },
  sandboxLevel: 'readonly'
})

export const searchHandler: ToolHandler = async (
  args: Record<string, unknown>,
  ctx
): Promise<ToolResult> => {
  const pattern = typeof args.pattern === 'string' ? args.pattern : ''
  if (!pattern) {
    return { ok: false, data: null, error: 'pattern is required' }
  }

  const maxResults = typeof args.maxResults === 'number' && args.maxResults > 0
    ? Math.min(args.maxResults, 200)
    : 50

  const root = normalize(ctx.workspaceRoot)

  // Build grep command safely — no shell metacharacter interpretation
  const grepArgs: string[] = [
    '-rn', '--color=never',
    `--max-count=${maxResults}`,
    '--',
    pattern,
    root
  ]

  // Add glob filter if specified
  const globFilter = typeof args.glob === 'string' ? args.glob : ''
  if (globFilter) {
    grepArgs.splice(2, 0, `--include=${globFilter}`)
  }

  return new Promise<ToolResult>((resolve) => {
    execFile('grep', grepArgs, { timeout: 15000, shell: false }, (error, stdout, stderr) => {
      // grep returns exit code 1 when no matches — that is not an error for us
      if (error && error.code !== 1) {
        resolve({ ok: false, data: null, error: error.message })
        return
      }

      const output = stdout || ''
      if (!output.trim()) {
        return resolve({ ok: true, data: { matches: [], total: 0 } })
      }

      const lines = output.trim().split('\n').slice(0, maxResults)
      const matches = lines.map((line) => {
        const firstColon = line.indexOf(':')
        const secondColon = line.indexOf(':', firstColon + 1)
        if (firstColon === -1 || secondColon === -1) return { file: line, line: 0, text: '' }
        return {
          file: line.slice(0, firstColon).replace(root + '/', '').replace(root + '\\', ''),
          line: parseInt(line.slice(firstColon + 1, secondColon), 10) || 0,
          text: line.slice(secondColon + 1)
        }
      })

      resolve({ ok: true, data: { matches, total: matches.length } })
    })
  })
}
