import type { ClientRequest } from 'electron'

export interface ChatMessageInput {
  role: string
  content: string | object[]
  toolCallId?: string
}

export interface StreamDeltaResult {
  text: string
  done: boolean
}

export interface ToolDefinition {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

export interface ProviderStrategy {
  readonly protocolType: string
  readonly isSubscription: boolean
  readonly loginUrl?: string

  buildUrl(baseUrl: string): string
  buildBody(model: string, messages: ChatMessageInput[], stream: boolean, options?: { tools?: ToolDefinition[] }): string
  applyAuthHeaders(request: ClientRequest, apiKey: string): void
  applyExtraHeaders(request: ClientRequest, baseUrl: string): void
  parseStreamDelta?(parsed: Record<string, unknown>, ctx: { lastSentLength?: number }): StreamDeltaResult | null
}

export interface ProviderStrategyFetch extends Omit<ProviderStrategy, 'applyAuthHeaders' | 'applyExtraHeaders'> {
  applyAuthHeaders(headers: Headers, apiKey: string): void
  applyExtraHeaders(headers: Headers, baseUrl: string): void
}
