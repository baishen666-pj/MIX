import { describe, it, expect } from 'vitest'
import { claudeStrategy } from '../claude'

describe('ClaudeStrategy', () => {
  const strategy = claudeStrategy

  it('has correct protocolType', () => {
    expect(strategy.protocolType).toBe('claude')
  })

  it('is not subscription', () => {
    expect(strategy.isSubscription).toBe(false)
  })

  it('builds correct URL', () => {
    expect(strategy.buildUrl('https://api.anthropic.com/v1')).toBe('https://api.anthropic.com/v1/messages')
    expect(strategy.buildUrl('https://api.anthropic.com/v1/')).toBe('https://api.anthropic.com/v1/messages')
  })

  it('builds body with system message separated', () => {
    const messages = [
      { role: 'system', content: 'You are helpful' },
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi' }
    ]
    const body = JSON.parse(strategy.buildBody('claude-sonnet-4-20250514', messages, true))
    expect(body.system).toBe('You are helpful')
    expect(body.messages).toEqual([
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi' }
    ])
    expect(body.max_tokens).toBe(4096)
    expect(body.stream).toBe(true)
    expect(body.model).toBe('claude-sonnet-4-20250514')
  })

  it('builds body without system message', () => {
    const messages = [{ role: 'user', content: 'hello' }]
    const body = JSON.parse(strategy.buildBody('claude-sonnet-4-20250514', messages, false))
    expect(body.system).toBeUndefined()
    expect(body.messages).toEqual([{ role: 'user', content: 'hello' }])
    expect(body.stream).toBe(false)
  })

  it('maps non-assistant roles to user', () => {
    const messages = [
      { role: 'user', content: 'hello' },
      { role: 'tool', content: 'result' },
      { role: 'assistant', content: 'hi' }
    ]
    const body = JSON.parse(strategy.buildBody('claude-sonnet-4-20250514', messages, true))
    expect(body.messages[0].role).toBe('user')
    expect(body.messages[1].role).toBe('user')
    expect(body.messages[2].role).toBe('assistant')
  })

  it('applyAuthHeaders sets claude-specific headers', () => {
    const headers: Record<string, string> = {}
    const mockRequest = {
      setHeader: (key: string, value: string) => { headers[key] = value }
    } as any
    strategy.applyAuthHeaders(mockRequest, 'sk-ant-key')
    expect(headers['x-api-key']).toBe('sk-ant-key')
    expect(headers['anthropic-version']).toBe('2023-06-01')
  })

  it('applyAuthHeaders skips empty key', () => {
    const headers: Record<string, string> = {}
    const mockRequest = {
      setHeader: (key: string, value: string) => { headers[key] = value }
    } as any
    strategy.applyAuthHeaders(mockRequest, '')
    expect(headers['x-api-key']).toBeUndefined()
  })

  it('buildBody without tools omits tools from body', () => {
    const messages = [{ role: 'user', content: 'hello' }]
    const body = JSON.parse(strategy.buildBody('claude-sonnet-4-20250514', messages, true))
    expect(body.tools).toBeUndefined()
  })

  it('buildBody with tools adds Claude format', () => {
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
    const body = JSON.parse(strategy.buildBody('claude-sonnet-4-20250514', messages, true, { tools }))
    expect(body.tools).toEqual([
      {
        name: 'get_weather',
        description: 'Get current weather',
        input_schema: {
          type: 'object',
          properties: { city: { type: 'string' } },
          required: ['city']
        }
      }
    ])
  })

  it('buildBody with multiple tools preserves order', () => {
    const messages = [{ role: 'user', content: 'hello' }]
    const tools = [
      { name: 'tool_a', description: 'First tool', inputSchema: { type: 'object' } },
      { name: 'tool_b', description: 'Second tool', inputSchema: { type: 'object' } }
    ]
    const body = JSON.parse(strategy.buildBody('claude-sonnet-4-20250514', messages, false, { tools }))
    expect(body.tools).toHaveLength(2)
    expect(body.tools[0].name).toBe('tool_a')
    expect(body.tools[1].name).toBe('tool_b')
  })

  it('buildBody with empty tools array omits tools from body', () => {
    const messages = [{ role: 'user', content: 'hello' }]
    const body = JSON.parse(strategy.buildBody('claude-sonnet-4-20250514', messages, true, { tools: [] }))
    expect(body.tools).toBeUndefined()
  })

  it('buildBody with tools and system message combines both', () => {
    const messages = [
      { role: 'system', content: 'You are helpful' },
      { role: 'user', content: 'hello' }
    ]
    const tools = [
      { name: 'search', description: 'Search the web', inputSchema: { type: 'object' as const } }
    ]
    const body = JSON.parse(strategy.buildBody('claude-sonnet-4-20250514', messages, true, { tools }))
    expect(body.system).toBe('You are helpful')
    expect(body.tools).toEqual([
      { name: 'search', description: 'Search the web', input_schema: { type: 'object' } }
    ])
  })
})
