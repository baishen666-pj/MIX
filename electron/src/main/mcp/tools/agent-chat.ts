/**
 * MCP tool handler: agent.chat
 * Sends a message to the active provider and returns the full response.
 */

import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getActiveProvider } from '../../config'
import { getStrategy } from '../../providers/registry'

export function registerAgentChatTool(server: McpServer): void {
  server.registerTool(
    'agent.chat',
    {
      description: 'Send a chat message to the active AI agent and receive the complete response.',
      inputSchema: {
        message: z.string().describe('The message to send to the agent.'),
        model: z.string().optional().describe('Optional model override.')
      }
    },
    async (args) => {
      const message = args.message
      if (!message.trim()) {
        return {
          content: [{ type: 'text' as const, text: 'Error: message is required' }],
          isError: true
        }
      }

      const provider = getActiveProvider()
      const model = args.model || provider.defaultModel

      try {
        const response = await fetchCompletion(provider, model, message)
        return {
          content: [{ type: 'text' as const, text: response }]
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        return {
          content: [{ type: 'text' as const, text: `Error: ${msg}` }],
          isError: true
        }
      }
    }
  )
}

interface ProviderLike {
  readonly baseUrl: string
  readonly apiKey: string
  readonly type: string
}

function fetchCompletion(provider: ProviderLike, model: string, message: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const strategy = getStrategy(provider.type)
    const url = strategy.buildUrl(provider.baseUrl)
    const body = strategy.buildBody(model, [{ role: 'user', content: message }], false)

    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (provider.apiKey) {
      if (provider.type === 'claude') {
        headers['x-api-key'] = provider.apiKey
        headers['anthropic-version'] = '2023-06-01'
      } else {
        headers['Authorization'] = `Bearer ${provider.apiKey}`
      }
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 60000)

    fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal
    })
      .then((res) => {
        if (!res.ok) {
          return res.text().then((text) => {
            let msg = `HTTP ${res.status}`
            try {
              const parsed = JSON.parse(text)
              msg = parsed.error?.message || parsed.message || msg
            } catch { /* noop */ }
            throw new Error(msg)
          })
        }
        return res.json() as Promise<Record<string, unknown>>
      })
      .then((data) => {
        clearTimeout(timeout)
        // OpenAI-compatible response
        const choices = data.choices as Array<{ message: { content: string } }> | undefined
        if (choices && choices.length > 0) {
          resolve(choices[0].message.content)
          return
        }
        // Claude response
        const content = data.content as Array<{ type: string; text: string }> | undefined
        if (content && content.length > 0) {
          resolve(content.filter((c) => c.type === 'text').map((c) => c.text).join(''))
          return
        }
        resolve(JSON.stringify(data))
      })
      .catch((err: unknown) => {
        clearTimeout(timeout)
        reject(err)
      })
  })
}
