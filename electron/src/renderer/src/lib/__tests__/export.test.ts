import { describe, it, expect } from 'vitest'
import {
  exportAsMarkdown,
  exportAsJson,
  exportAsTxt,
  getExportContent,
  getExportFileName,
} from '../export'
import type { ChatMessage } from '../../../../shared/types'

const SAMPLE_MESSAGES: ChatMessage[] = [
  { id: '1', role: 'user', content: 'Hello', timestamp: new Date('2025-01-01T10:00:00').getTime() },
  { id: '2', role: 'agent', content: 'Hi there!', timestamp: new Date('2025-01-01T10:00:05').getTime() },
  { id: '3', role: 'system', content: 'System note', timestamp: new Date('2025-01-01T10:00:10').getTime() },
  { id: '4', role: 'error', content: 'Something failed', timestamp: new Date('2025-01-01T10:00:15').getTime() },
]

describe('exportAsMarkdown', () => {
  it('includes title and metadata', () => {
    const result = exportAsMarkdown(SAMPLE_MESSAGES, 'Test Chat')
    expect(result).toContain('# Test Chat')
    expect(result).toContain('导出时间')
    expect(result).toContain('消息数量: 4')
  })

  it('formats user and agent messages', () => {
    const result = exportAsMarkdown(SAMPLE_MESSAGES, 'Test')
    expect(result).toContain('### 用户')
    expect(result).toContain('Hello')
    expect(result).toContain('### AI')
    expect(result).toContain('Hi there!')
  })

  it('formats system messages as italic', () => {
    const result = exportAsMarkdown(SAMPLE_MESSAGES, 'Test')
    expect(result).toContain('*System note*')
  })

  it('formats error messages', () => {
    const result = exportAsMarkdown(SAMPLE_MESSAGES, 'Test')
    expect(result).toContain('[错误]')
    expect(result).toContain('Something failed')
  })
})

describe('exportAsJson', () => {
  it('produces valid JSON with metadata', () => {
    const result = exportAsJson(SAMPLE_MESSAGES, 'Test Chat')
    const parsed = JSON.parse(result)
    expect(parsed.title).toBe('Test Chat')
    expect(parsed.messageCount).toBe(4)
    expect(parsed.messages).toHaveLength(4)
    expect(parsed.messages[0].role).toBe('user')
  })

  it('includes ISO timestamps', () => {
    const result = exportAsJson(SAMPLE_MESSAGES, 'Test')
    const parsed = JSON.parse(result)
    expect(parsed.messages[0].timestamp).toContain('2025')
  })
})

describe('exportAsTxt', () => {
  it('includes header with separator', () => {
    const result = exportAsTxt(SAMPLE_MESSAGES, 'Test Chat')
    expect(result).toContain('Test Chat')
    expect(result).toContain('='.repeat(60))
  })

  it('formats messages with role labels', () => {
    const result = exportAsTxt(SAMPLE_MESSAGES, 'Test')
    expect(result).toContain('用户:')
    expect(result).toContain('AI:')
    expect(result).toContain('Hello')
  })
})

describe('getExportContent', () => {
  it('routes to markdown format', () => {
    const result = getExportContent(SAMPLE_MESSAGES, 'Test', 'markdown')
    expect(result).toContain('# Test')
  })

  it('routes to json format', () => {
    const result = getExportContent(SAMPLE_MESSAGES, 'Test', 'json')
    expect(() => JSON.parse(result)).not.toThrow()
  })

  it('routes to txt format', () => {
    const result = getExportContent(SAMPLE_MESSAGES, 'Test', 'txt')
    expect(result).toContain('='.repeat(60))
  })
})

describe('getExportFileName', () => {
  it('generates markdown filename', () => {
    expect(getExportFileName('My Chat', 'markdown')).toBe('My_Chat.md')
  })

  it('generates json filename', () => {
    expect(getExportFileName('My Chat', 'json')).toBe('My_Chat.json')
  })

  it('generates txt filename', () => {
    expect(getExportFileName('My Chat', 'txt')).toBe('My_Chat.txt')
  })

  it('truncates long names', () => {
    const long = 'A'.repeat(100)
    const result = getExportFileName(long, 'markdown')
    expect(result.length).toBeLessThan(60)
  })

  it('preserves Chinese characters', () => {
    const result = getExportFileName('对话记录', 'markdown')
    expect(result).toContain('对话记录')
  })
})
