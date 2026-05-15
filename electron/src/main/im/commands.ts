import type { ImMessage } from './types'

export interface CommandResult {
  reply: string
  image?: string
}

type CommandHandler = (msg: ImMessage, args: string) => Promise<CommandResult | null>

const commands = new Map<string, CommandHandler>()

export function registerCommand(name: string, handler: CommandHandler): void {
  commands.set(name, handler)
}

export async function handleMessage(msg: ImMessage): Promise<CommandResult | null> {
  const text = msg.text.trim()

  // Slash command
  if (text.startsWith('/')) {
    const parts = text.split(/\s+/)
    const cmd = parts[0].toLowerCase()
    const args = parts.slice(1).join(' ')

    const handler = commands.get(cmd)
    if (handler) {
      return handler(msg, args)
    }

    return { reply: `未知命令: ${cmd}\n输入 /help 查看可用命令` }
  }

  // Default: forward to chat handler
  const chatHandler = commands.get('/chat')
  if (chatHandler) {
    return chatHandler(msg, text)
  }

  return null
}

// Built-in help command
registerCommand('/help', async () => ({
  reply: `AI GUI 远程控制命令：

直接发消息 — 与 AI 对话
/screenshot — 截取当前屏幕
/status — 查看当前状态
/model — 查看当前模型
/model <name> — 切换模型
/workflow — 查看工作流列表
/workflow <name> — 触发工作流`
}))
