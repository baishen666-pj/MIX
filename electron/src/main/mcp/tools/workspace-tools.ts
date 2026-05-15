/**
 * MCP tool handlers: workspace.readFile and workspace.writeFile
 * Delegates to the internal tool registry.
 */

import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { executeTool } from '../../tools/registry'

const DEFAULT_WORKSPACE = process.cwd()

export function registerWorkspaceReadFileTool(server: McpServer): void {
  server.registerTool(
    'workspace.readFile',
    {
      description: 'Read the contents of a file in the project workspace.',
      inputSchema: {
        path: z.string().describe('Relative or absolute file path within the workspace.')
      }
    },
    async (args) => {
      const result = await executeTool(
        'workspace.readFile',
        { path: args.path },
        { workspaceRoot: DEFAULT_WORKSPACE }
      )

      if (!result.ok) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${result.error}` }],
          isError: true
        }
      }

      return {
        content: [{ type: 'text' as const, text: result.data as string }]
      }
    }
  )
}

export function registerWorkspaceWriteFileTool(server: McpServer): void {
  server.registerTool(
    'workspace.writeFile',
    {
      description: 'Write content to a file in the project workspace. Creates parent directories if needed.',
      inputSchema: {
        path: z.string().describe('Relative or absolute file path within the workspace.'),
        content: z.string().describe('The content to write to the file.')
      }
    },
    async (args) => {
      const result = await executeTool(
        'workspace.writeFile',
        { path: args.path, content: args.content },
        { workspaceRoot: DEFAULT_WORKSPACE }
      )

      if (!result.ok) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${result.error}` }],
          isError: true
        }
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result.data) }]
      }
    }
  )
}
