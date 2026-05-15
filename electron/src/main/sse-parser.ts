export interface ParsedUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  cost?: number
}

export interface SseCallbacks {
  onChunk: (text: string) => void
  onToolProgress?: (tool: string) => void
  onUsage?: (usage: ParsedUsage) => void
  onError?: (message: string) => void
  onDone?: () => void
  onReasoning?: (text: string) => void
  onToolCallStart?: (call: { index: number; id: string; name: string }) => void
  onToolCallDelta?: (index: number, argumentsChunk: string) => void
}

const toolProgressRe = /^`([^\s`]+)\s+([^`]+)`$/

export function processCustomEvent(
  eventType: string,
  data: string,
  cb: Pick<SseCallbacks, 'onToolProgress'>
): boolean {
  if (eventType === 'agent.tool.progress' && cb.onToolProgress) {
    try {
      const payload = JSON.parse(data)
      const label = payload.label || payload.tool || ''
      const emoji = payload.emoji || ''
      cb.onToolProgress(emoji ? `${emoji} ${label}` : label)
      return true
    } catch { /* noop */ }
  }
  return false
}

export interface SseDataResult {
  done: boolean
  hasContent: boolean
  error?: string
  hasToolCalls?: boolean
}

export function processSseData(
  data: string,
  cb: SseCallbacks,
  state: { hasContent: boolean; lastError: string }
): SseDataResult {
  if (data === '[DONE]') {
    if (state.hasContent) cb.onDone?.()
    return { done: true, hasContent: state.hasContent, error: state.lastError }
  }

  try {
    const parsed = JSON.parse(data)

    if (parsed.error) {
      state.lastError = parsed.error.message || JSON.stringify(parsed.error)
      return { done: false, hasContent: state.hasContent }
    }

    // Claude format: content_block_start with tool_use
    if (parsed.type === 'content_block_start' && parsed.content_block?.type === 'tool_use') {
      cb.onToolCallStart?.({
        index: parsed.index ?? 0,
        id: parsed.content_block.id ?? '',
        name: parsed.content_block.name ?? ''
      })
      return { done: false, hasContent: state.hasContent }
    }

    // Claude format: content_block_delta with input_json_delta
    if (parsed.type === 'content_block_delta') {
      const d = parsed.delta as Record<string, unknown> | undefined
      if (d?.type === 'input_json_delta' && d.partial_json) {
        cb.onToolCallDelta?.(parsed.index ?? 0, d.partial_json as string)
      }
      if (d?.type === 'text_delta' && d.text) {
        state.hasContent = true
        cb.onChunk(d.text as string)
      }
      return { done: false, hasContent: state.hasContent }
    }

    // Claude format: message_delta with stop_reason
    if (parsed.type === 'message_delta' && parsed.delta?.stop_reason === 'tool_use') {
      return { done: false, hasContent: state.hasContent, hasToolCalls: true }
    }

    const delta = parsed.choices?.[0]?.delta

    if (parsed.usage && cb.onUsage) {
      cb.onUsage({
        promptTokens: parsed.usage.prompt_tokens || 0,
        completionTokens: parsed.usage.completion_tokens || 0,
        totalTokens: parsed.usage.total_tokens || 0,
        cost: parsed.usage.cost
      })
    }

    if (delta?.content) {
      const content = delta.content.trim()
      const match = toolProgressRe.exec(content)
      if (match && cb.onToolProgress) {
        cb.onToolProgress(`${match[1]} ${match[2]}`)
      } else {
        state.hasContent = true
        cb.onChunk(delta.content)
      }
    }

    if (delta?.reasoning_content && cb.onReasoning) {
      cb.onReasoning(delta.reasoning_content)
    }

    // OpenAI format: delta.tool_calls
    if (delta?.tool_calls && Array.isArray(delta.tool_calls)) {
      for (const tc of delta.tool_calls) {
        if (tc.id && cb.onToolCallStart) {
          cb.onToolCallStart({ index: tc.index, id: tc.id, name: tc.function?.name || '' })
        }
        if (tc.function?.arguments && cb.onToolCallDelta) {
          cb.onToolCallDelta(tc.index, tc.function.arguments)
        }
      }
    }

    // OpenAI format: finish_reason tool_calls
    if (parsed.choices?.[0]?.finish_reason === 'tool_calls') {
      return { done: false, hasContent: state.hasContent, hasToolCalls: true }
    }
  } catch { /* noop */ }

  return { done: false, hasContent: state.hasContent }
}

export function parseSseBlock(
  block: string
): { eventType: string; data: string } | null {
  let eventType = ''
  let dataLine = ''
  for (const line of block.split('\n')) {
    if (line.startsWith('event: ')) {
      eventType = line.slice(7).trim()
    } else if (line.startsWith('data: ')) {
      dataLine = line.slice(6)
    }
  }
  if (!dataLine) return null
  return { eventType, data: dataLine }
}
