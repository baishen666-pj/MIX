/**
 * File operation tools: workspace.readFile and workspace.writeFile.
 */

import { readFile, writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { join, dirname, normalize } from 'path'
import type { ToolSpec, ToolHandler, ToolResult } from './types'

// --- workspace.readFile ---

export const readFileSpec: ToolSpec = Object.freeze({
  name: 'workspace.readFile',
  description: 'Read the contents of a file in the project workspace.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      path: { type: 'string', description: 'Relative or absolute file path within the workspace.' }
    },
    required: ['path']
  },
  sandboxLevel: 'readonly'
})

export const readFileHandler: ToolHandler = async (
  args: Record<string, unknown>,
  ctx
): Promise<ToolResult> => {
  const filePath = typeof args.path === 'string' ? args.path : ''
  if (!filePath) {
    return { ok: false, data: null, error: 'path is required' }
  }

  const absolute = normalize(filePath.startsWith('/') || filePath.startsWith('\\')
    ? filePath
    : join(ctx.workspaceRoot, filePath))

  // Prevent path traversal outside workspace
  if (!absolute.startsWith(normalize(ctx.workspaceRoot))) {
    return { ok: false, data: null, error: 'Path is outside the workspace root' }
  }

  if (!existsSync(absolute)) {
    return { ok: false, data: null, error: `File not found: ${filePath}` }
  }

  try {
    const content = await readFile(absolute, 'utf-8')
    return { ok: true, data: content }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, data: null, error: message }
  }
}

// --- workspace.writeFile ---

export const writeFileSpec: ToolSpec = Object.freeze({
  name: 'workspace.writeFile',
  description: 'Write content to a file in the project workspace. Creates parent directories if needed.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      path: { type: 'string', description: 'Relative or absolute file path within the workspace.' },
      content: { type: 'string', description: 'The content to write to the file.' }
    },
    required: ['path', 'content']
  },
  sandboxLevel: 'write'
})

export const writeFileHandler: ToolHandler = async (
  args: Record<string, unknown>,
  ctx
): Promise<ToolResult> => {
  const filePath = typeof args.path === 'string' ? args.path : ''
  const content = typeof args.content === 'string' ? args.content : ''

  if (!filePath) {
    return { ok: false, data: null, error: 'path is required' }
  }

  const absolute = normalize(filePath.startsWith('/') || filePath.startsWith('\\')
    ? filePath
    : join(ctx.workspaceRoot, filePath))

  // Prevent path traversal outside workspace
  if (!absolute.startsWith(normalize(ctx.workspaceRoot))) {
    return { ok: false, data: null, error: 'Path is outside the workspace root' }
  }

  try {
    const dir = dirname(absolute)
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true })
    }
    await writeFile(absolute, content, 'utf-8')
    return { ok: true, data: { written: filePath, bytes: Buffer.byteLength(content, 'utf-8') } }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, data: null, error: message }
  }
}
