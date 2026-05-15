/**
 * MCP tool handler: agent.list
 * Lists all configured agents (providers).
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getConnectionConfig } from '../../config'

export function registerAgentListTool(server: McpServer): void {
  server.tool(
    'agent.list',
    'List all configured AI agents (providers) in the application.',
    {},
    async () => {
      const config = getConnectionConfig()
      const agents = config.providers.map((p) => ({
        id: p.id,
        name: p.name,
        type: p.type,
        models: p.models,
        defaultModel: p.defaultModel
      }))
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(agents, null, 2) }]
      }
    }
  )
}
