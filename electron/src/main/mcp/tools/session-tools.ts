/**
 * MCP tool handlers: session.list and session.get
 */

import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import * as sessions from '../../sessions'

export function registerSessionListTool(server: McpServer): void {
  server.registerTool(
    'session.list',
    {
      description: 'List recent chat sessions.',
      inputSchema: {
        limit: z.number().optional().describe('Maximum sessions to return (default 50, max 200).')
      }
    },
    async (args) => {
      const limit = args.limit ? Math.min(args.limit, 200) : 50
      const rows = sessions.listSessions(limit)
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(rows, null, 2) }]
      }
    }
  )
}

export function registerSessionGetTool(server: McpServer): void {
  server.registerTool(
    'session.get',
    {
      description: 'Get all messages from a specific session.',
      inputSchema: {
        sessionId: z.string().describe('The session ID to retrieve messages for.')
      }
    },
    async (args) => {
      const sessionId = args.sessionId
      if (!sessionId) {
        return {
          content: [{ type: 'text' as const, text: 'Error: sessionId is required' }],
          isError: true
        }
      }

      const messages = sessions.getSessionMessages(sessionId)
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(messages, null, 2) }]
      }
    }
  )
}
