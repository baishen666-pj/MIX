import type { ChatMessage } from '../../../shared/types'

export type ExportFormat = 'markdown' | 'json' | 'txt'

export function exportAsMarkdown(messages: ChatMessage[], title: string): string {
  const lines: string[] = [
    `# ${title}`,
    '',
    `> 导出时间: ${new Date().toLocaleString('zh-CN')}`,
    `> 消息数量: ${messages.length}`,
    '',
    '---',
    ''
  ]

  for (const msg of messages) {
    const time = new Date(msg.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    const roleLabels: Record<ChatMessage['role'], string> = { user: '用户', agent: 'AI', system: '系统', error: '错误', tool_call: '工具调用', tool_result: '工具结果' }
    const roleLabel = roleLabels[msg.role]

    if (msg.role === 'system') {
      lines.push(`*${msg.content}*`)
      lines.push('')
      continue
    }

    if (msg.role === 'error') {
      lines.push(`**[错误]** ${msg.content}`)
      lines.push('')
      continue
    }

    lines.push(`### ${roleLabel} *${time}*`)
    lines.push('')
    lines.push(msg.content)
    lines.push('')
    lines.push('---')
    lines.push('')
  }

  return lines.join('\n')
}

export function exportAsJson(messages: ChatMessage[], title: string): string {
  const data = {
    title,
    exportedAt: new Date().toISOString(),
    messageCount: messages.length,
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
      timestamp: new Date(m.timestamp).toISOString()
    }))
  }
  return JSON.stringify(data, null, 2)
}

export function exportAsTxt(messages: ChatMessage[], title: string): string {
  const lines: string[] = [
    `${title}`,
    `导出时间: ${new Date().toLocaleString('zh-CN')}`,
    `${'='.repeat(60)}`,
    ''
  ]

  for (const msg of messages) {
    const time = new Date(msg.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    const roleLabels: Record<ChatMessage['role'], string> = { user: '用户', agent: 'AI', system: '系统', error: '错误', tool_call: '工具调用', tool_result: '工具结果' }
    const roleLabel = roleLabels[msg.role]
    lines.push(`[${time}] ${roleLabel}:`)
    lines.push(msg.content)
    lines.push('')
  }

  return lines.join('\n')
}

export function getExportContent(messages: ChatMessage[], title: string, format: ExportFormat): string {
  switch (format) {
    case 'markdown': return exportAsMarkdown(messages, title)
    case 'json': return exportAsJson(messages, title)
    case 'txt': return exportAsTxt(messages, title)
  }
}

export function getExportFileName(title: string, format: ExportFormat): string {
  const safeName = title.replace(/[^a-zA-Z0-9一-鿿-_]/g, '_').slice(0, 50)
  const ext = format === 'markdown' ? 'md' : format === 'json' ? 'json' : 'txt'
  return `${safeName}.${ext}`
}
