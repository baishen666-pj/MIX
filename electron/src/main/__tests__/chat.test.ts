import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SseCallbacks } from '../sse-parser'

const { mockGetActiveProvider, mockNetRequest } = vi.hoisted(() => ({
  mockGetActiveProvider: vi.fn(),
  mockNetRequest: vi.fn()
}))

vi.mock('electron', () => ({
  net: {
    request: mockNetRequest
  }
}))

vi.mock('../config', () => ({
  getActiveProvider: mockGetActiveProvider
}))

import { sendMessage } from '../chat'

function makeCb(overrides?: Partial<SseCallbacks>): SseCallbacks {
  return {
    onChunk: vi.fn(),
    onDone: vi.fn(),
    onError: vi.fn(),
    onToolProgress: vi.fn(),
    onUsage: vi.fn(),
    onReasoning: vi.fn(),
    ...overrides,
  }
}

function makeMockRequest() {
  return {
    setHeader: vi.fn(),
    on: vi.fn(),
    write: vi.fn(),
    end: vi.fn(),
    abort: vi.fn()
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('sendMessage - routing', () => {
  it('routes to OpenAI-compatible endpoint for openai provider', () => {
    mockGetActiveProvider.mockReturnValue({
      type: 'openai',
      baseUrl: 'https://api.openai.com/v1/',
      apiKey: 'test-key',
      defaultModel: 'gpt-4o',
      models: ['gpt-4o']
    })

    const mockRequest = makeMockRequest()
    mockNetRequest.mockReturnValue(mockRequest)

    const cb = makeCb()
    const controller = sendMessage({ messages: [{ role: 'user', content: 'Hello' }] }, cb)

    expect(mockNetRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        url: 'https://api.openai.com/v1/chat/completions'
      })
    )
    expect(mockRequest.setHeader).toHaveBeenCalledWith('Authorization', 'Bearer test-key')
    expect(mockRequest.write).toHaveBeenCalled()
    expect(controller).toBeInstanceOf(AbortController)
  })

  it('routes to Claude messages endpoint for claude provider', () => {
    mockGetActiveProvider.mockReturnValue({
      type: 'claude',
      baseUrl: 'https://api.anthropic.com/v1/',
      apiKey: 'claude-key',
      defaultModel: 'claude-sonnet-4-20250514',
      models: []
    })

    const mockRequest = makeMockRequest()
    mockNetRequest.mockReturnValue(mockRequest)

    const cb = makeCb()
    sendMessage({ messages: [{ role: 'user', content: 'Hello' }] }, cb)

    expect(mockNetRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://api.anthropic.com/v1/messages'
      })
    )
    expect(mockRequest.setHeader).toHaveBeenCalledWith('x-api-key', 'claude-key')
    expect(mockRequest.setHeader).toHaveBeenCalledWith('anthropic-version', '2023-06-01')
  })

  it('routes to ChatGPT endpoint for chatgpt provider', () => {
    mockGetActiveProvider.mockReturnValue({
      type: 'chatgpt',
      baseUrl: 'https://chatgpt.com/backend-api',
      apiKey: 'chatgpt-token',
      defaultModel: 'gpt-4o',
      models: []
    })

    const mockRequest = makeMockRequest()
    mockNetRequest.mockReturnValue(mockRequest)

    const cb = makeCb()
    sendMessage({ messages: [{ role: 'user', content: 'Hello' }] }, cb)

    expect(mockNetRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://chatgpt.com/backend-api/conversation'
      })
    )
    expect(mockRequest.setHeader).toHaveBeenCalledWith('Accept', 'text/event-stream')
  })

  it('strips trailing slash from baseUrl', () => {
    mockGetActiveProvider.mockReturnValue({
      type: 'openai',
      baseUrl: 'https://api.example.com/v1/',
      apiKey: 'key',
      defaultModel: 'model',
      models: []
    })

    const mockRequest = makeMockRequest()
    mockNetRequest.mockReturnValue(mockRequest)

    const cb = makeCb()
    sendMessage({ messages: [{ role: 'user', content: 'Hi' }] }, cb)

    expect(mockNetRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://api.example.com/v1/chat/completions'
      })
    )
  })

  it('sets OpenRouter headers when baseUrl contains openrouter.ai', () => {
    mockGetActiveProvider.mockReturnValue({
      type: 'openai',
      baseUrl: 'https://openrouter.ai/api/v1',
      apiKey: 'or-key',
      defaultModel: 'openai/gpt-4o',
      models: []
    })

    const mockRequest = makeMockRequest()
    mockNetRequest.mockReturnValue(mockRequest)

    const cb = makeCb()
    sendMessage({ messages: [{ role: 'user', content: 'Hi' }] }, cb)

    expect(mockRequest.setHeader).toHaveBeenCalledWith('HTTP-Referer', 'https://github.com/ai-gui')
    expect(mockRequest.setHeader).toHaveBeenCalledWith('X-Title', 'AI GUI')
  })
})

describe('sendMessage - request body', () => {
  it('uses model from opts when provided', () => {
    mockGetActiveProvider.mockReturnValue({
      type: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'key',
      defaultModel: 'gpt-4o',
      models: []
    })

    const mockRequest = makeMockRequest()
    mockNetRequest.mockReturnValue(mockRequest)

    const cb = makeCb()
    sendMessage({ messages: [{ role: 'user', content: 'Hi' }], model: 'gpt-3.5-turbo' }, cb)

    const body = JSON.parse(mockRequest.write.mock.calls[0][0])
    expect(body.model).toBe('gpt-3.5-turbo')
  })

  it('uses defaultModel when no model in opts', () => {
    mockGetActiveProvider.mockReturnValue({
      type: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'key',
      defaultModel: 'gpt-4o',
      models: []
    })

    const mockRequest = makeMockRequest()
    mockNetRequest.mockReturnValue(mockRequest)

    const cb = makeCb()
    sendMessage({ messages: [{ role: 'user', content: 'Hi' }] }, cb)

    const body = JSON.parse(mockRequest.write.mock.calls[0][0])
    expect(body.model).toBe('gpt-4o')
  })

  it('builds Claude body with system message separation', () => {
    mockGetActiveProvider.mockReturnValue({
      type: 'claude',
      baseUrl: 'https://api.anthropic.com/v1',
      apiKey: 'key',
      defaultModel: 'claude-sonnet-4-20250514',
      models: []
    })

    const mockRequest = makeMockRequest()
    mockNetRequest.mockReturnValue(mockRequest)

    const cb = makeCb()
    sendMessage({
      messages: [
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'Hello' }
      ]
    }, cb)

    const body = JSON.parse(mockRequest.write.mock.calls[0][0])
    expect(body.system).toBe('You are helpful')
    expect(body.messages).toHaveLength(1)
    expect(body.messages[0].role).toBe('user')
    expect(body.max_tokens).toBe(4096)
    expect(body.stream).toBe(true)
  })

  it('builds ChatGPT body with message conversion', () => {
    mockGetActiveProvider.mockReturnValue({
      type: 'chatgpt',
      baseUrl: 'https://chatgpt.com/backend-api',
      apiKey: 'token',
      defaultModel: 'gpt-4o',
      models: []
    })

    const mockRequest = makeMockRequest()
    mockNetRequest.mockReturnValue(mockRequest)

    const cb = makeCb()
    sendMessage({
      messages: [
        { role: 'system', content: 'Be concise' },
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi' }
      ]
    }, cb)

    const body = JSON.parse(mockRequest.write.mock.calls[0][0])
    expect(body.action).toBe('next')
    expect(body.messages).toHaveLength(2)
    expect(body.messages[0].author.role).toBe('user')
    expect(body.messages[1].author.role).toBe('assistant')
    expect(body.system_message.parts).toContain('Be concise')
  })

  it('does not set Authorization header when apiKey is empty for ollama', () => {
    mockGetActiveProvider.mockReturnValue({
      type: 'ollama',
      baseUrl: 'http://localhost:11434/v1',
      apiKey: '',
      defaultModel: 'llama3',
      models: []
    })

    const mockRequest = makeMockRequest()
    mockNetRequest.mockReturnValue(mockRequest)

    const cb = makeCb()
    sendMessage({ messages: [{ role: 'user', content: 'Hi' }] }, cb)

    const authCalls = mockRequest.setHeader.mock.calls.filter(
      (call: string[]) => call[0] === 'Authorization'
    )
    expect(authCalls).toHaveLength(0)
  })
})

describe('sendMessage - abort controller', () => {
  it('returns an AbortController', () => {
    mockGetActiveProvider.mockReturnValue({
      type: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'key',
      defaultModel: 'gpt-4o',
      models: []
    })

    const mockRequest = makeMockRequest()
    mockNetRequest.mockReturnValue(mockRequest)

    const cb = makeCb()
    const controller = sendMessage({ messages: [{ role: 'user', content: 'Hi' }] }, cb)

    expect(controller).toBeInstanceOf(AbortController)
    expect(controller.signal).toBeDefined()
  })
})
