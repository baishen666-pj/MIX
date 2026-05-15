/**
 * MCP Server implementation for AI GUI.
 * Exposes agent, session, workflow, and workspace capabilities to external callers.
 *
 * Uses stdio transport by default. In Electron main process, the server
 * communicates over a named pipe so that child processes can connect.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

import { registerAgentListTool } from './tools/agent-tools'
import { registerAgentChatTool } from './tools/agent-chat'
import { registerSessionListTool, registerSessionGetTool } from './tools/session-tools'
import { registerWorkflowListTool, registerWorkflowExecuteTool } from './tools/workflow-tools'
import { registerWorkspaceReadFileTool, registerWorkspaceWriteFileTool } from './tools/workspace-tools'

export interface McpServerState {
  readonly server: McpServer
  readonly transport: StdioServerTransport
  start(): Promise<void>
  stop(): Promise<void>
}

let mcpState: McpServerState | null = null

/** Create (but do not start) the MCP server. */
export function createMcpServer(): McpServerState {
  const server = new McpServer(
    { name: 'ai-gui', version: '0.1.0' },
    { capabilities: { tools: {} } }
  )

  // Register all MCP tools
  registerAgentListTool(server)
  registerAgentChatTool(server)
  registerSessionListTool(server)
  registerSessionGetTool(server)
  registerWorkflowListTool(server)
  registerWorkflowExecuteTool(server)
  registerWorkspaceReadFileTool(server)
  registerWorkspaceWriteFileTool(server)

  const transport = new StdioServerTransport()

  const state: McpServerState = {
    server,
    transport,
    async start() {
      await server.connect(transport)
    },
    async stop() {
      await server.close()
    }
  }

  mcpState = state
  return state
}

/** Get the current MCP server state, if started. */
export function getMcpServer(): McpServerState | null {
  return mcpState
}

/** Start the MCP server. Creates it if not yet created. */
export async function startMcpServer(): Promise<McpServerState> {
  if (mcpState) return mcpState
  const state = createMcpServer()
  await state.start()
  return state
}

/** Stop the MCP server if running. */
export async function stopMcpServer(): Promise<void> {
  if (mcpState) {
    await mcpState.stop()
    mcpState = null
  }
}
