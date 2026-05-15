/**
 * MCP module entry point.
 * Re-exports server and client functionality.
 */

export {
  createMcpServer,
  getMcpServer,
  startMcpServer,
  stopMcpServer,
  type McpServerState
} from './server'

export {
  connectStdioServer,
  disconnectServer,
  getConnectedServers,
  getConnectedServer,
  callExternalTool,
  disconnectAll,
  type McpServerConfig,
  type ConnectedMcpServer,
  type McpToolInfo
} from './client'
