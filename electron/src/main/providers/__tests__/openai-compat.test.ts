import { describe, it, expect } from 'vitest'
import { openAICompatibleStrategy } from '../openai-compat'

describe('OpenAICompatibleStrategy', () => {
  const strategy = openAICompatibleStrategy

  it('has correct protocolType', () => {
    expect(strategy.protocolType).toBe('openai')
  })

  it('is not subscription', () => {
    expect(strategy.isSubscription).toBe(false)
  })

  it('builds correct URL', () => {
    expect(strategy.buildUrl('https://api.openai.com/v1')).toBe('https://api.openai.com/v1/chat/completions')
    expect(strategy.buildUrl('https://api.openai.com/v1/')).toBe('https://api.openai.com/v1/chat/completions')
  })

  it('builds correct body', () => {
    const messages = [{ role: 'user', content: 'hello' }]
    const body = JSON.parse(strategy.buildBody('gpt-4o', messages, true))
    expect(body).toEqual({ model: 'gpt-4o', messages, stream: true })
  })

  it('builds non-streaming body', () => {
    const body = JSON.parse(strategy.buildBody('gpt-4o', [], false))
    expect(body.stream).toBe(false)
  })

  it('applyAuthHeaders sets Bearer token', () => {
    const headers: Record<string, string> = {}
    const mockRequest = {
      setHeader: (key: string, value: string) => { headers[key] = value }
    } as any
    strategy.applyAuthHeaders(mockRequest, 'sk-test-key')
    expect(headers['Authorization']).toBe('Bearer sk-test-key')
  })

  it('applyAuthHeaders skips empty key', () => {
    const headers: Record<string, string> = {}
    const mockRequest = {
      setHeader: (key: string, value: string) => { headers[key] = value }
    } as any
    strategy.applyAuthHeaders(mockRequest, '')
    expect(headers['Authorization']).toBeUndefined()
  })

  it('applyExtraHeaders adds OpenRouter headers', () => {
    const headers: Record<string, string> = {}
    const mockRequest = {
      setHeader: (key: string, value: string) => { headers[key] = value }
    } as any
    strategy.applyExtraHeaders(mockRequest, 'https://openrouter.ai/api/v1')
    expect(headers['HTTP-Referer']).toBe('https://github.com/ai-gui')
    expect(headers['X-Title']).toBe('AI GUI')
  })

  it('applyExtraHeaders skips non-OpenRouter', () => {
    const headers: Record<string, string> = {}
    const mockRequest = {
      setHeader: (key: string, value: string) => { headers[key] = value }
    } as any
    strategy.applyExtraHeaders(mockRequest, 'https://api.openai.com/v1')
    expect(headers['HTTP-Referer']).toBeUndefined()
  })

  it('buildBody without tools omits tools from body', () => {
    const messages = [{ role: 'user', content: 'hello' }]
    const body = JSON.parse(strategy.buildBody('gpt-4o', messages, true))
    expect(body.tools).toBeUndefined()
  })

  it('buildBody with tools adds OpenAI function format', () => {
    const messages = [{ role: 'user', content: 'hello' }]
    const tools = [
      {
        name: 'get_weather',
        description: 'Get current weather',
        inputSchema: {
          type: 'object' as const,
          properties: { city: { type: 'string' as const } },
          required: ['city']
        }
      }
    ]
    const body = JSON.parse(strategy.buildBody('gpt-4o', messages, true, { tools }))
    expect(body.tools).toEqual([
      {
        type: 'function',
        function: {
          name: 'get_weather',
          description: 'Get current weather',
          parameters: {
            type: 'object',
            properties: { city: { type: 'string' } },
            required: ['city']
          }
        }
      }
    ])
  })

  it('buildBody with multiple tools preserves order', () => {
    const messages = [{ role: 'user', content: 'hello' }]
    const tools = [
      { name: 'tool_a', description: 'First tool', inputSchema: { type: 'object' } },
      { name: 'tool_b', description: 'Second tool', inputSchema: { type: 'object' } },
      { name: 'tool_c', description: 'Third tool', inputSchema: { type: 'object' } }
    ]
    const body = JSON.parse(strategy.buildBody('gpt-4o', messages, false, { tools }))
    expect(body.tools).toHaveLength(3)
    expect(body.tools[0].function.name).toBe('tool_a')
    expect(body.tools[1].function.name).toBe('tool_b')
    expect(body.tools[2].function.name).toBe('tool_c')
  })

  it('buildBody with empty tools array omits tools from body', () => {
    const messages = [{ role: 'user', content: 'hello' }]
    const body = JSON.parse(strategy.buildBody('gpt-4o', messages, true, { tools: [] }))
    expect(body.tools).toBeUndefined()
  })
})
