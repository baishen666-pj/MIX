import type { ClientRequest } from 'electron'
import type { ProviderStrategy, ChatMessageInput, StreamDeltaResult, ToolDefinition } from './types'

export class ChatGPTSubscriptionStrategy implements ProviderStrategy {
  readonly protocolType = 'chatgpt'
  readonly isSubscription = true
  readonly loginUrl = 'https://chatgpt.com/auth/login'

  buildUrl(_baseUrl: string): string {
    return 'https://chatgpt.com/backend-api/conversation'
  }

  buildBody(model: string, messages: ChatMessageInput[], _stream: boolean, _options?: { tools?: ToolDefinition[] }): string {
    const chatgptMessages = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        author: { role: m.role === 'assistant' ? 'assistant' : 'user' },
        content: { content_type: 'text', parts: [typeof m.content === 'string' ? m.content : ''] }
      }))

    const systemMsg = messages.find((m) => m.role === 'system')
    const systemParts = systemMsg && typeof systemMsg.content === 'string' ? [systemMsg.content] : undefined

    return JSON.stringify({
      action: 'next',
      messages: chatgptMessages,
      model,
      parent_message_id: `parent-${Date.now()}`,
      ...(systemParts ? { system_message: { content_type: 'text', parts: systemParts } } : {}),
      stream: true
    })
  }

  applyAuthHeaders(request: ClientRequest, apiKey: string): void {
    request.setHeader('Authorization', `Bearer ${apiKey}`)
  }

  applyExtraHeaders(request: ClientRequest, _baseUrl: string): void {
    request.setHeader('User-Agent', 'AI-GUI/0.1.0')
    request.setHeader('Accept', 'text/event-stream')
  }

  parseStreamDelta(parsed: Record<string, unknown>, ctx: { lastSentLength?: number }): StreamDeltaResult | null {
    const message = parsed.message as Record<string, unknown> | undefined
    if (!message) return null

    const content = message.content as Record<string, unknown> | undefined
    const parts = content?.parts as string[] | undefined
    if (!parts || !Array.isArray(parts)) return null

    const text = parts.join('')
    const lastSentLength = ctx.lastSentLength ?? 0
    const delta = text.slice(lastSentLength)

    const status = message.status as string | undefined
    const done = status === 'finished_successfully'

    if (!delta && !done) return null

    return { text: delta, done }
  }
}

export const chatGPTSubscriptionStrategy = new ChatGPTSubscriptionStrategy()
