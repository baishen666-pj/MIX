import { describe, it, expect, vi } from 'vitest'
import { parseSseBlock, processSseData, processCustomEvent } from '../sse-parser'
import type { SseCallbacks } from '../sse-parser'

function makeCb(overrides?: Partial<SseCallbacks>): SseCallbacks {
  return {
    onChunk: vi.fn(),
    onDone: vi.fn(),
    onError: vi.fn(),
    onToolProgress: vi.fn(),
    onUsage: vi.fn(),
    onReasoning: vi.fn(),
    onToolCallStart: vi.fn(),
    onToolCallDelta: vi.fn(),
    ...overrides,
  }
}

function makeState() {
  return { hasContent: false, lastError: '' }
}

describe('parseSseBlock', () => {
  it('parses event + data lines', () => {
    const result = parseSseBlock('event: agent.tool.progress\ndata: {"tool":"web"}')
    expect(result).toEqual({ eventType: 'agent.tool.progress', data: '{"tool":"web"}' })
  })

  it('parses data-only block', () => {
    const result = parseSseBlock('data: {"choices":[]}')
    expect(result).toEqual({ eventType: '', data: '{"choices":[]}' })
  })

  it('returns null when no data line', () => {
    expect(parseSseBlock('event: ping')).toBeNull()
  })

  it('returns null for empty block', () => {
    expect(parseSseBlock('')).toBeNull()
  })

  it('handles multi-line data (last data wins)', () => {
    const result = parseSseBlock('data: first\ndata: second')
    expect(result).toEqual({ eventType: '', data: 'second' })
  })
})

describe('processCustomEvent', () => {
  it('handles agent.tool.progress with emoji', () => {
    const cb = makeCb()
    const handled = processCustomEvent('agent.tool.progress', '{"tool":"web","label":"搜索","emoji":"🔍"}', cb)
    expect(handled).toBe(true)
    expect(cb.onToolProgress).toHaveBeenCalledWith('🔍 搜索')
  })

  it('handles agent.tool.progress without emoji', () => {
    const cb = makeCb()
    const handled = processCustomEvent('agent.tool.progress', '{"tool":"web","label":"搜索"}', cb)
    expect(handled).toBe(true)
    expect(cb.onToolProgress).toHaveBeenCalledWith('搜索')
  })

  it('falls back to tool name when label missing', () => {
    const cb = makeCb()
    processCustomEvent('agent.tool.progress', '{"tool":"code"}', cb)
    expect(cb.onToolProgress).toHaveBeenCalledWith('code')
  })

  it('ignores invalid JSON', () => {
    const cb = makeCb()
    expect(processCustomEvent('agent.tool.progress', 'not-json', cb)).toBe(false)
  })

  it('returns false for non-tool-progress events', () => {
    const cb = makeCb()
    expect(processCustomEvent('ping', '{}', cb)).toBe(false)
  })

  it('returns false when callback missing', () => {
    const cb = makeCb({ onToolProgress: undefined })
    expect(processCustomEvent('agent.tool.progress', '{"tool":"web"}', cb)).toBe(false)
  })
})

describe('processSseData', () => {
  it('returns done=true for [DONE]', () => {
    const cb = makeCb()
    const state = makeState()
    const result = processSseData('[DONE]', cb, state)
    expect(result.done).toBe(true)
  })

  it('calls onDone when hasContent is true on [DONE]', () => {
    const cb = makeCb()
    const state = { hasContent: true, lastError: '' }
    processSseData('[DONE]', cb, state)
    expect(cb.onDone).toHaveBeenCalled()
  })

  it('does not call onDone when no content received', () => {
    const cb = makeCb()
    const state = makeState()
    processSseData('[DONE]', cb, state)
    expect(cb.onDone).not.toHaveBeenCalled()
  })

  it('extracts delta content and calls onChunk', () => {
    const cb = makeCb()
    const state = makeState()
    processSseData('{"choices":[{"delta":{"content":"Hello"}}]}', cb, state)
    expect(cb.onChunk).toHaveBeenCalledWith('Hello')
    expect(state.hasContent).toBe(true)
  })

  it('detects tool progress in content', () => {
    const cb = makeCb()
    const state = makeState()
    processSseData('{"choices":[{"delta":{"content":"`🔍 search_web `"}}]}', cb, state)
    expect(cb.onToolProgress).toHaveBeenCalledWith('🔍 search_web ')
    expect(cb.onChunk).not.toHaveBeenCalled()
  })

  it('extracts usage info', () => {
    const cb = makeCb()
    const state = makeState()
    processSseData('{"usage":{"prompt_tokens":10,"completion_tokens":20,"total_tokens":30,"cost":0.05}}', cb, state)
    expect(cb.onUsage).toHaveBeenCalledWith({
      promptTokens: 10,
      completionTokens: 20,
      totalTokens: 30,
      cost: 0.05,
    })
  })

  it('handles error in parsed JSON', () => {
    const cb = makeCb()
    const state = makeState()
    const result = processSseData('{"error":{"message":"Rate limited"}}', cb, state)
    expect(result.done).toBe(false)
    expect(state.lastError).toBe('Rate limited')
  })

  it('handles error as string', () => {
    const cb = makeCb()
    const state = makeState()
    processSseData('{"error":"timeout"}', cb, state)
    expect(state.lastError).toBe('"timeout"')
  })

  it('handles reasoning content', () => {
    const cb = makeCb()
    const state = makeState()
    processSseData('{"choices":[{"delta":{"reasoning_content":"thinking..."}}]}', cb, state)
    expect(cb.onReasoning).toHaveBeenCalledWith('thinking...')
  })

  it('does not call onReasoning when callback missing', () => {
    const cb = makeCb({ onReasoning: undefined })
    const state = makeState()
    const result = processSseData('{"choices":[{"delta":{"reasoning_content":"hmm"}}]}', cb, state)
    expect(result.done).toBe(false)
  })

  it('ignores invalid JSON gracefully', () => {
    const cb = makeCb()
    const state = makeState()
    const result = processSseData('not-valid-json', cb, state)
    expect(result.done).toBe(false)
    expect(cb.onChunk).not.toHaveBeenCalled()
  })

  it('passes through whitespace-only delta content', () => {
    const cb = makeCb()
    const state = makeState()
    processSseData('{"choices":[{"delta":{"content":"   "}}]}', cb, state)
    expect(cb.onChunk).toHaveBeenCalledWith('   ')
  })

  it('defaults usage tokens to 0 when missing', () => {
    const cb = makeCb()
    const state = makeState()
    processSseData('{"usage":{}}', cb, state)
    expect(cb.onUsage).toHaveBeenCalledWith({
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      cost: undefined,
    })
  })

  // --- OpenAI tool_calls tests ---

  it('OpenAI tool_calls delta: new tool call start', () => {
    const cb = makeCb()
    const state = makeState()
    const data = JSON.stringify({
      choices: [{
        delta: {
          tool_calls: [{
            index: 0,
            id: 'call_abc123',
            function: { name: 'get_weather', arguments: '' }
          }]
        }
      }]
    })
    const result = processSseData(data, cb, state)
    expect(result.done).toBe(false)
    expect(cb.onToolCallStart).toHaveBeenCalledWith({
      index: 0,
      id: 'call_abc123',
      name: 'get_weather'
    })
    expect(cb.onToolCallDelta).not.toHaveBeenCalled()
  })

  it('OpenAI tool_calls delta: arguments chunk', () => {
    const cb = makeCb()
    const state = makeState()
    const data = JSON.stringify({
      choices: [{
        delta: {
          tool_calls: [{
            index: 0,
            function: { arguments: '{"city": "Tokyo"}' }
          }]
        }
      }]
    })
    processSseData(data, cb, state)
    expect(cb.onToolCallDelta).toHaveBeenCalledWith(0, '{"city": "Tokyo"}')
    expect(cb.onToolCallStart).not.toHaveBeenCalled()
  })

  it('OpenAI tool_calls delta: multiple tool calls', () => {
    const cb = makeCb()
    const state = makeState()
    const data = JSON.stringify({
      choices: [{
        delta: {
          tool_calls: [
            { index: 0, id: 'call_001', function: { name: 'get_weather', arguments: '' } },
            { index: 1, id: 'call_002', function: { name: 'search', arguments: '' } }
          ]
        }
      }]
    })
    processSseData(data, cb, state)
    expect(cb.onToolCallStart).toHaveBeenCalledTimes(2)
    expect(cb.onToolCallStart).toHaveBeenCalledWith({ index: 0, id: 'call_001', name: 'get_weather' })
    expect(cb.onToolCallStart).toHaveBeenCalledWith({ index: 1, id: 'call_002', name: 'search' })
  })

  it('OpenAI finish_reason tool_calls sets hasToolCalls', () => {
    const cb = makeCb()
    const state = makeState()
    const data = JSON.stringify({
      choices: [{ finish_reason: 'tool_calls', delta: {} }]
    })
    const result = processSseData(data, cb, state)
    expect(result.hasToolCalls).toBe(true)
    expect(result.done).toBe(false)
  })

  it('OpenAI finish_reason non-tool_calls does not set hasToolCalls', () => {
    const cb = makeCb()
    const state = makeState()
    const data = JSON.stringify({
      choices: [{ finish_reason: 'stop', delta: {} }]
    })
    const result = processSseData(data, cb, state)
    expect(result.hasToolCalls).toBeUndefined()
  })

  // --- Claude format tool_use tests ---

  it('Claude content_block_start tool_use triggers onToolCallStart', () => {
    const cb = makeCb()
    const state = makeState()
    const data = JSON.stringify({
      type: 'content_block_start',
      index: 1,
      content_block: {
        type: 'tool_use',
        id: 'toolu_01abc',
        name: 'read_file'
      }
    })
    const result = processSseData(data, cb, state)
    expect(result.done).toBe(false)
    expect(cb.onToolCallStart).toHaveBeenCalledWith({
      index: 1,
      id: 'toolu_01abc',
      name: 'read_file'
    })
  })

  it('Claude content_block_start defaults index to 0 when missing', () => {
    const cb = makeCb()
    const state = makeState()
    const data = JSON.stringify({
      type: 'content_block_start',
      content_block: {
        type: 'tool_use',
        id: 'toolu_no_idx',
        name: 'bash'
      }
    })
    processSseData(data, cb, state)
    expect(cb.onToolCallStart).toHaveBeenCalledWith({
      index: 0,
      id: 'toolu_no_idx',
      name: 'bash'
    })
  })

  it('Claude content_block_delta input_json_delta triggers onToolCallDelta', () => {
    const cb = makeCb()
    const state = makeState()
    const data = JSON.stringify({
      type: 'content_block_delta',
      index: 0,
      delta: {
        type: 'input_json_delta',
        partial_json: '{"path": "/src/mai'
      }
    })
    const result = processSseData(data, cb, state)
    expect(result.done).toBe(false)
    expect(cb.onToolCallDelta).toHaveBeenCalledWith(0, '{"path": "/src/mai')
    expect(cb.onChunk).not.toHaveBeenCalled()
  })

  it('Claude content_block_delta defaults index to 0 when missing', () => {
    const cb = makeCb()
    const state = makeState()
    const data = JSON.stringify({
      type: 'content_block_delta',
      delta: {
        type: 'input_json_delta',
        partial_json: '{}'
      }
    })
    processSseData(data, cb, state)
    expect(cb.onToolCallDelta).toHaveBeenCalledWith(0, '{}')
  })

  it('Claude content_block_delta text_delta triggers onChunk', () => {
    const cb = makeCb()
    const state = makeState()
    const data = JSON.stringify({
      type: 'content_block_delta',
      index: 0,
      delta: {
        type: 'text_delta',
        text: 'Hello from Claude'
      }
    })
    const result = processSseData(data, cb, state)
    expect(cb.onChunk).toHaveBeenCalledWith('Hello from Claude')
    expect(state.hasContent).toBe(true)
    expect(cb.onToolCallDelta).not.toHaveBeenCalled()
  })

  it('Claude content_block_delta with unknown delta type does nothing', () => {
    const cb = makeCb()
    const state = makeState()
    const data = JSON.stringify({
      type: 'content_block_delta',
      index: 0,
      delta: {
        type: 'thinking_delta',
        thinking: 'hmm'
      }
    })
    const result = processSseData(data, cb, state)
    expect(cb.onChunk).not.toHaveBeenCalled()
    expect(cb.onToolCallDelta).not.toHaveBeenCalled()
    expect(result.done).toBe(false)
  })

  it('Claude message_delta stop_reason tool_use sets hasToolCalls', () => {
    const cb = makeCb()
    const state = makeState()
    const data = JSON.stringify({
      type: 'message_delta',
      delta: { stop_reason: 'tool_use' }
    })
    const result = processSseData(data, cb, state)
    expect(result.hasToolCalls).toBe(true)
    expect(result.done).toBe(false)
  })

  it('Claude message_delta stop_reason end_turn does not set hasToolCalls', () => {
    const cb = makeCb()
    const state = makeState()
    const data = JSON.stringify({
      type: 'message_delta',
      delta: { stop_reason: 'end_turn' }
    })
    const result = processSseData(data, cb, state)
    expect(result.hasToolCalls).toBeUndefined()
  })

  // --- Mixed content + tool_calls stream ---

  it('mixed content + tool_calls stream: text then tool call', () => {
    const cb = makeCb()
    const state = makeState()

    // First chunk: text content
    processSseData(JSON.stringify({
      choices: [{ delta: { content: 'I will search for that.' } }]
    }), cb, state)
    expect(cb.onChunk).toHaveBeenCalledWith('I will search for that.')
    expect(state.hasContent).toBe(true)

    // Second chunk: tool call start
    processSseData(JSON.stringify({
      choices: [{ delta: { tool_calls: [{ index: 0, id: 'call_mixed', function: { name: 'search', arguments: '' } }] } }]
    }), cb, state)
    expect(cb.onToolCallStart).toHaveBeenCalledWith({ index: 0, id: 'call_mixed', name: 'search' })

    // Third chunk: tool arguments
    processSseData(JSON.stringify({
      choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '{"q":"test"}' } }] } }]
    }), cb, state)
    expect(cb.onToolCallDelta).toHaveBeenCalledWith(0, '{"q":"test"}')

    // Fourth chunk: finish with tool_calls
    const result = processSseData(JSON.stringify({
      choices: [{ finish_reason: 'tool_calls', delta: {} }]
    }), cb, state)
    expect(result.hasToolCalls).toBe(true)
    expect(result.hasContent).toBe(true)
  })

  it('does not call onToolCallStart when callback is undefined', () => {
    const cb = makeCb({ onToolCallStart: undefined })
    const state = makeState()
    const data = JSON.stringify({
      choices: [{
        delta: {
          tool_calls: [{ index: 0, id: 'call_x', function: { name: 'noop', arguments: '' } }]
        }
      }]
    })
    // Should not throw
    const result = processSseData(data, cb, state)
    expect(result.done).toBe(false)
  })

  it('does not call onToolCallDelta when callback is undefined', () => {
    const cb = makeCb({ onToolCallDelta: undefined })
    const state = makeState()
    const data = JSON.stringify({
      choices: [{
        delta: {
          tool_calls: [{ index: 0, function: { arguments: '{"a":1}' } }]
        }
      }]
    })
    const result = processSseData(data, cb, state)
    expect(result.done).toBe(false)
  })
})
