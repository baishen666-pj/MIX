/**
 * Shell execution tool with restricted command allowlist.
 * Mirrors the existing run-shell IPC handler logic.
 */

import { execFile } from 'child_process'
import type { ToolSpec, ToolHandler, ToolResult } from './types'

const ALLOWED_COMMANDS = [
  'node', 'python', 'python3', 'pip', 'npm', 'npx',
  'echo', 'dir', 'ls', 'cat', 'pwd', 'whoami', 'date', 'git', 'curl'
]

export const shellSpec: ToolSpec = Object.freeze({
  name: 'shell.execute',
  description: 'Execute an allowed shell command with a restricted allowlist. No shell metacharacters.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      command: { type: 'string', description: 'The command to execute (space-separated args).' },
      timeout: { type: 'number', description: 'Timeout in ms (default 10000).' }
    },
    required: ['command']
  },
  sandboxLevel: 'shell'
})

export const shellHandler: ToolHandler = async (
  args: Record<string, unknown>,
  ctx
): Promise<ToolResult> => {
  const rawCommand = typeof args.command === 'string' ? args.command : ''
  if (!rawCommand.trim()) {
    return { ok: false, data: null, error: 'command is required' }
  }

  const parts = rawCommand.trim().split(/\s+/)
  const baseCmd = parts[0].toLowerCase().replace(/\.(exe|cmd|bat|ps1)$/, '')

  if (!ALLOWED_COMMANDS.includes(baseCmd)) {
    return {
      ok: false,
      data: null,
      error: `Command "${parts[0]}" is not allowed. Allowed: ${ALLOWED_COMMANDS.join(', ')}`
    }
  }

  const timeout = typeof args.timeout === 'number' && args.timeout > 0
    ? Math.min(args.timeout, 30000)
    : 10000

  return new Promise<ToolResult>((resolve) => {
    if (ctx.signal?.aborted) {
      resolve({ ok: false, data: null, error: 'Aborted' })
      return
    }

    execFile(parts[0], parts.slice(1), { timeout, shell: false }, (error, stdout, stderr) => {
      if (error) {
        resolve({ ok: false, data: { stdout, stderr }, error: error.message })
      } else {
        resolve({ ok: true, data: { stdout: stdout || '', stderr: stderr || '' } })
      }
    })
  })
}
