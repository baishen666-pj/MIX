/**
 * Tests for the MCP client module.
 * Tests connection management logic without actual MCP server connections.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  getConnectedServers,
  getConnectedServer,
  disconnectServer,
  disconnectAll,
  type McpServerConfig
} from '../mcp/client'

describe('MCP Client — connection management', () => {
  beforeEach(async () => {
    await disconnectAll()
  })

  it('starts with no connected servers', () => {
    const servers = getConnectedServers()
    expect(servers).toEqual([])
  })

  it('getConnectedServer returns undefined for unknown id', () => {
    const server = getConnectedServer('nonexistent')
    expect(server).toBeUndefined()
  })

  it('disconnectServer does not throw for unknown id', async () => {
    await expect(disconnectServer('nonexistent')).resolves.toBeUndefined()
  })

  it('disconnectAll does not throw when no servers connected', async () => {
    await expect(disconnectAll()).resolves.toBeUndefined()
  })
})
