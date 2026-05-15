/**
 * MCP Client — connects to external MCP servers and discovers their tools.
 * Supports stdio (spawn process) and SSE (HTTP) transports.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

/** Configuration for an external MCP server connection. */
export interface McpServerConfig {
  /** Unique identifier for this server connection. */
  readonly id: string
  /** Human-readable name. */
  readonly name: string
  /** Transport type. */
  readonly transport: 'stdio' | 'sse'
  /** For stdio: the command to spawn. */
  readonly command?: string
  /** For stdio: arguments to pass. */
  readonly args?: string[]
  /** For stdio: environment variables. */
  readonly env?: Record<string, string>
  /** For SSE: the URL to connect to. */
  readonly url?: string
  /** Whether this server connection is enabled. */
  readonly enabled: boolean
}

/** A connected MCP client instance with its metadata. */
export interface ConnectedMcpServer {
  readonly config: McpServerConfig
  readonly client: Client
  readonly tools: McpToolInfo[]
}

/** Discovered tool from an external MCP server. */
export interface McpToolInfo {
  readonly serverId: string
  readonly name: string
  readonly description?: string
  readonly inputSchema?: Record<string, unknown>
}

const connections = new Map<string, ConnectedMcpServer>()

/** Connect to an external MCP server using stdio transport. */
export async function connectStdioServer(config: McpServerConfig): Promise<ConnectedMcpServer> {
  if (!config.command) throw new Error('command is required for stdio transport')

  const transport = new StdioClientTransport({
    command: config.command,
    args: config.args,
    env: config.env
  })

  const client = new Client(
    { name: 'ai-gui-client', version: '0.1.0' },
    { capabilities: {} }
  )

  await client.connect(transport)

  // Discover tools
  const toolsResult = await client.listTools()
  const tools: McpToolInfo[] = (toolsResult.tools || []).map((t) => ({
    serverId: config.id,
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema as Record<string, unknown> | undefined
  }))

  const entry: ConnectedMcpServer = { config, client, tools }
  connections.set(config.id, entry)
  return entry
}

/** Disconnect from an external MCP server. */
export async function disconnectServer(serverId: string): Promise<void> {
  const entry = connections.get(serverId)
  if (entry) {
    await entry.client.close()
    connections.delete(serverId)
  }
}

/** Get all connected servers. */
export function getConnectedServers(): ConnectedMcpServer[] {
  return Array.from(connections.values())
}

/** Get a connected server by id. */
export function getConnectedServer(serverId: string): ConnectedMcpServer | undefined {
  return connections.get(serverId)
}

/** Call a tool on a connected external MCP server. */
export async function callExternalTool(
  serverId: string,
  toolName: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const entry = connections.get(serverId)
  if (!entry) throw new Error(`MCP server not connected: ${serverId}`)

  const result = await entry.client.callTool({ name: toolName, arguments: args })
  return result
}

/** Disconnect all servers. */
export async function disconnectAll(): Promise<void> {
  const ids = Array.from(connections.keys())
  await Promise.all(ids.map(disconnectServer))
}
