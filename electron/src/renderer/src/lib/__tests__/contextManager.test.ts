import { describe, it, expect } from 'vitest'
import {
  estimateTokens,
  createAgentOutput,
  buildWorkflowContext,
  resolvePromptWithContext,
  buildSystemPromptForWorkflow,
  compressChatContext,
  getContextUsageInfo,
} from '../contextManager'
import type { ChatMessage } from '../../../../shared/types'

describe('estimateTokens', () => {
  it('estimates based on character count', () => {
    expect(estimateTokens('')).toBe(0)
    expect(estimateTokens('abc')).toBe(1)
    expect(estimateTokens('abcdef')).toBe(2)
  })
})

describe('createAgentOutput', () => {
  it('creates output with token estimate', () => {
    const start = Date.now() - 100
    const output = createAgentOutput('node-1', 'Agent 1', 'Hello world', start, { key: 'val' })
    expect(output.nodeId).toBe('node-1')
    expect(output.nodeLabel).toBe('Agent 1')
    expect(output.content).toBe('Hello world')
    expect(output.metadata).toEqual({ key: 'val' })
    expect(output.tokenEstimate).toBe(estimateTokens('Hello world'))
    expect(output.durationMs).toBeGreaterThanOrEqual(0)
  })
})

describe('buildWorkflowContext', () => {
  it('builds context with outputs', () => {
    const outputs = [
      createAgentOutput('n1', 'Researcher', 'Found data', Date.now() - 50),
      createAgentOutput('n2', 'Writer', 'Wrote article', Date.now()),
    ]
    const ctx = buildWorkflowContext('Test Flow', 'n3', outputs)
    expect(ctx.workflowName).toBe('Test Flow')
    expect(ctx.currentNode).toBe('n3')
    expect(ctx.outputs).toHaveLength(2)
    expect(ctx.summary).toContain('Researcher')
    expect(ctx.summary).toContain('Writer')
    expect(ctx.totalTokens).toBe(outputs[0].tokenEstimate + outputs[1].tokenEstimate)
  })

  it('handles empty outputs', () => {
    const ctx = buildWorkflowContext('Empty', 'n1', [])
    expect(ctx.summary).toContain('无上游输出')
    expect(ctx.totalTokens).toBe(0)
  })
})

describe('resolvePromptWithContext', () => {
  const outputs = [
    createAgentOutput('researcher', 'Researcher', 'Found results', Date.now()),
  ]
  const ctx = buildWorkflowContext('Flow', 'writer', outputs)

  it('replaces {{input}}', () => {
    const result = resolvePromptWithContext('Input: {{input}}', outputs, 'test input', ctx)
    expect(result).toBe('Input: test input')
  })

  it('replaces {{summary}}', () => {
    const result = resolvePromptWithContext('Summary: {{summary}}', outputs, '', ctx)
    expect(result).toContain('Researcher')
  })

  it('replaces {{$nodeId}} references', () => {
    const result = resolvePromptWithContext('{{$researcher}}', outputs, '', ctx)
    expect(result).toBe('Found results')
  })

  it('replaces {{node:id.field}} references', () => {
    const result = resolvePromptWithContext(
      '{{node:researcher.label}} - {{node:researcher.content}}',
      outputs, '', ctx
    )
    expect(result).toBe('Researcher - Found results')
  })

  it('replaces {{node:id.duration}} and {{node:id.tokens}}', () => {
    const result = resolvePromptWithContext(
      '{{node:researcher.duration}} {{node:researcher.tokens}}',
      outputs, '', ctx
    )
    expect(result).toMatch(/\d+\.\d+s ~\d+/)
  })

  it('returns empty string for unknown node references', () => {
    const result = resolvePromptWithContext('{{$unknown}}', outputs, '', ctx)
    expect(result).toBe('')
  })

  it('handles {{context}} replacement', () => {
    const result = resolvePromptWithContext('{{context}}', outputs, '', ctx)
    expect(result).toContain('"workflowName"')
  })
})

describe('buildSystemPromptForWorkflow', () => {
  it('builds from soul + base + context', () => {
    const ctx = buildWorkflowContext('Flow', 'n1', [])
    const prompt = buildSystemPromptForWorkflow('base prompt', 'soul text', ctx)
    expect(prompt).toContain('soul text')
    expect(prompt).toContain('base prompt')
    expect(prompt).toContain('Flow')
    expect(prompt).toContain('n1')
  })

  it('works without soul prompt', () => {
    const ctx = buildWorkflowContext('Flow', 'n1', [])
    const prompt = buildSystemPromptForWorkflow('base', undefined, ctx)
    expect(prompt).toContain('base')
    expect(prompt).not.toContain('undefined')
  })

  it('includes upstream summary when outputs exist', () => {
    const outputs = [createAgentOutput('n1', 'Agent', 'content', Date.now())]
    const ctx = buildWorkflowContext('Flow', 'n2', outputs)
    const prompt = buildSystemPromptForWorkflow(undefined, undefined, ctx)
    expect(prompt).toContain('上游摘要')
  })
})

describe('compressChatContext', () => {
  function makeMsg(role: ChatMessage['role'], content: string, i: number): ChatMessage {
    return { id: `msg-${i}`, role, content, timestamp: Date.now() + i * 1000 }
  }

  it('returns filtered messages as-is when short', () => {
    const msgs = [makeMsg('user', 'hi', 0), makeMsg('agent', 'hello', 1)]
    const result = compressChatContext(msgs)
    expect(result).toHaveLength(2)
  })

  it('filters out system and error messages', () => {
    const msgs = [
      makeMsg('system', 'sys', 0),
      makeMsg('user', 'hi', 1),
      makeMsg('error', 'err', 2),
    ]
    const result = compressChatContext(msgs)
    expect(result).toHaveLength(1)
    expect(result[0].role).toBe('user')
  })

  it('compresses long conversations', () => {
    const msgs: ChatMessage[] = []
    for (let i = 0; i < 20; i++) {
      msgs.push(makeMsg('user', `User message ${i} with lots of content to exceed limit `.repeat(20), i * 2))
      msgs.push(makeMsg('agent', `Agent reply ${i} with lots of content to exceed limit `.repeat(20), i * 2 + 1))
    }
    const result = compressChatContext(msgs)
    expect(result.length).toBeLessThan(msgs.length)
    expect(result[0].content).toContain('历史对话摘要')
    expect(result[0].id).toContain('context-summary-')
  })
})

describe('getContextUsageInfo', () => {
  it('returns usage info for messages', () => {
    const msgs: ChatMessage[] = [
      { id: '1', role: 'user', content: 'Hello', timestamp: Date.now() },
      { id: '2', role: 'agent', content: 'World', timestamp: Date.now() },
    ]
    const info = getContextUsageInfo(msgs)
    expect(info.messageCount).toBe(2)
    expect(info.totalChars).toBe(10)
    expect(info.estimatedTokens).toBeGreaterThan(0)
    expect(info.isCompressed).toBe(false)
  })

  it('detects compressed context', () => {
    const msgs: ChatMessage[] = [
      { id: 'context-summary-1', role: 'agent', content: 'Summary', timestamp: Date.now() },
    ]
    const info = getContextUsageInfo(msgs)
    expect(info.isCompressed).toBe(true)
  })
})
