import { ipcMain, BrowserWindow } from 'electron'
import { registerConnector, startConnector, stopConnector, stopAll, getConnectorStatuses, setMessageHandler } from './registry'
import { handleMessage, registerCommand } from './commands'
import type { ImConfig, ImMessage } from './types'
import { FeishuConnector } from './feishu'
import { WecomConnector } from './wecom'
import { WecomWebhookConnector } from './wecom-webhook'
import { getActiveProvider } from '../config'
import { sendMessage } from '../chat'
import { sendRequest, isRunning as isBridgeRunning } from '../computer-use/bridge'

export function registerImIpc(mainWindow: BrowserWindow): void {
  // Chat command: forward to AI and reply
  registerCommand('/chat', async (_msg, text) => {
    try {
      const provider = getActiveProvider()
      if (!provider.apiKey && provider.type !== 'ollama') {
        return { reply: '错误: 未配置 API Key' }
      }

      const response = await new Promise<string>((resolve, reject) => {
        let accumulated = ''
        const controller = sendMessage(
          { messages: [{ role: 'user', content: text }] },
          {
            onChunk(chunk) { accumulated += chunk },
            onDone() { resolve(accumulated) },
            onError(msg) { reject(new Error(msg)) }
          }
        )
        setTimeout(() => {
          controller.abort()
          if (accumulated) resolve(accumulated)
          else reject(new Error('AI 响应超时'))
        }, 60000)
      })

      return { reply: response || '（AI 无回复）' }
    } catch (err: unknown) {
      const e = err instanceof Error ? err.message : String(err)
      return { reply: `错误: ${e}` }
    }
  })

  // Screenshot command
  registerCommand('/screenshot', async () => {
    if (!isBridgeRunning()) {
      return { reply: '错误: Computer Use 未启动' }
    }
    try {
      const res = await sendRequest('screenshot', {})
      if (res.result) {
        const data = res.result as { base64: string; width: number; height: number }
        return { reply: `截图成功 (${data.width}x${data.height})`, image: data.base64 }
      }
      return { reply: '错误: 截图失败' }
    } catch (err: unknown) {
      return { reply: `错误: ${err instanceof Error ? err.message : String(err)}` }
    }
  })

  // Status command
  registerCommand('/status', async () => {
    const provider = getActiveProvider()
    return { reply: `AI GUI v0.5.0\n模型: ${provider.name} / ${provider.defaultModel}\nComputer Use: ${isBridgeRunning() ? '运行中' : '未启动'}\n时间: ${new Date().toLocaleString('zh-CN')}` }
  })

  // Model command
  registerCommand('/model', async (_msg, args) => {
    if (!args.trim()) {
      const provider = getActiveProvider()
      return { reply: `当前模型: ${provider.name} / ${provider.defaultModel}` }
    }
    return { reply: `模型切换功能待实现` }
  })

  // Set up message handler: process IM messages and reply
  setMessageHandler(async (message: ImMessage) => {
    // Notify renderer
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('im-message', message)
    }

    const result = await handleMessage(message)
    if (!result) return

    const connector = registerConnector_getConnector(message.platform)
    if (!connector) return

    try {
      if (result.image && connector.sendImage) {
        await connector.sendImage(message.chatId, result.image)
      }
      if (result.reply) {
        await connector.sendMessage(message.chatId, result.reply)
      }
    } catch {
      // Ignore send errors
    }
  })

  // IPC handlers
  ipcMain.handle('im-start', async (_e, config: ImConfig) => {
    try {
      let connector
      switch (config.platform) {
        case 'feishu':
          connector = new FeishuConnector({ appId: config.appId, appSecret: config.appSecret })
          break
        case 'wecom':
          connector = new WecomConnector({ corpId: config.corpId, corpSecret: config.corpSecret, agentId: config.agentId })
          break
        case 'wecom-webhook':
          connector = new WecomWebhookConnector(config.key)
          break
        default:
          return false
      }
      registerConnector(connector)
      const ok = await startConnector(config.platform)
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send('im-status', getConnectorStatuses())
      }
      return ok
    } catch {
      return false
    }
  })

  ipcMain.handle('im-stop', (_e, platform: string) => {
    stopConnector(platform)
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('im-status', getConnectorStatuses())
    }
    return true
  })

  ipcMain.handle('im-status', () => getConnectorStatuses())

  ipcMain.handle('im-send', async (_e, platform: string, chatId: string, text: string) => {
    const connector = registerConnector_getConnector(platform)
    if (!connector?.isRunning()) return false
    await connector.sendMessage(chatId, text)
    return true
  })
}

function registerConnector_getConnector(platform: string) {
  const { getConnector } = require('./registry')
  return getConnector(platform) as import('./types').ImConnector | undefined
}

export function cleanupIm(): void {
  stopAll()
}
