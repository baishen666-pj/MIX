import { describe, it, expect } from 'vitest'
import { chatGPTSubscriptionStrategy } from '../chatgpt-subscription'

describe('ChatGPTSubscriptionStrategy', () => {
  const strategy = chatGPTSubscriptionStrategy

  it('has correct protocolType', () => {
    expect(strategy.protocolType).toBe('chatgpt')
  })

  it('is subscription', () => {
    expect(strategy.isSubscription).toBe(true)
  })

  it('has loginUrl', () => {
    expect(strategy.loginUrl).toBe('https://chatgpt.com/auth/login')
  })

  it('builds correct URL (ignores baseUrl)', () => {
    expect(strategy.buildUrl('anything')).toBe('https://chatgpt.com/backend-api/conversation')
  })

  it('builds body in ChatGPT format', () => {
    const messages = [
      { role: 'system', content: 'You are helpful' },
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi there' }
    ]
    const body = JSON.parse(strategy.buildBody('gpt-5.5', messages, true))

    expect(body.action).toBe('next')
    expect(body.model).toBe('gpt-5.5')
    expect(body.stream).toBe(true)
    expect(body.system_message.parts).toEqual(['You are helpful'])

    expect(body.messages).toHaveLength(2)
    expect(body.messages[0].author.role).toBe('user')
    expect(body.messages[0].content.parts).toEqual(['hello'])
    expect(body.messages[1].author.role).toBe('assistant')
    expect(body.messages[1].content.parts).toEqual(['hi there'])
  })

  it('builds body without system message', () => {
    const messages = [{ role: 'user', content: 'hello' }]
    const body = JSON.parse(strategy.buildBody('gpt-5.5', messages, true))
    expect(body.system_message).toBeUndefined()
    expect(body.messages).toHaveLength(1)
  })

  it('applyAuthHeaders sets Bearer token', () => {
    const headers: Record<string, string> = {}
    const mockRequest = {
      setHeader: (key: string, value: string) => { headers[key] = value }
    } as any
    strategy.applyAuthHeaders(mockRequest, 'token-123')
    expect(headers['Authorization']).toBe('Bearer token-123')
  })

  it('applyExtraHeaders sets User-Agent and Accept', () => {
    const headers: Record<string, string> = {}
    const mockRequest = {
      setHeader: (key: string, value: string) => { headers[key] = value }
    } as any
    strategy.applyExtraHeaders(mockRequest, '')
    expect(headers['User-Agent']).toBe('AI-GUI/0.1.0')
    expect(headers['Accept']).toBe('text/event-stream')
  })

  it('parseStreamDelta extracts text delta', () => {
    const parsed = {
      message: {
        content: { parts: ['Hello World'] },
        status: 'in_progress'
      }
    }
    const result = strategy.parseStreamDelta!(parsed, { lastSentLength: 0 })
    expect(result).toEqual({ text: 'Hello World', done: false })
  })

  it('parseStreamDelta tracks lastSentLength', () => {
    const parsed = {
      message: {
        content: { parts: ['Hello World More'] },
        status: 'in_progress'
      }
    }
    const result = strategy.parseStreamDelta!(parsed, { lastSentLength: 11 })
    expect(result).toEqual({ text: ' More', done: false })
  })

  it('parseStreamDelta detects completion', () => {
    const parsed = {
      message: {
        content: { parts: ['Hello World'] },
        status: 'finished_successfully'
      }
    }
    const result = strategy.parseStreamDelta!(parsed, { lastSentLength: 11 })
    expect(result).toEqual({ text: '', done: true })
  })

  it('parseStreamDelta returns null for no message', () => {
    expect(strategy.parseStreamDelta!({}, {})).toBeNull()
  })

  it('parseStreamDelta returns null for no parts', () => {
    expect(strategy.parseStreamDelta!({ message: { content: {} } }, {})).toBeNull()
  })
})
