import { net } from 'electron'
import type { ImConnector, ImCard } from './types'

export class WecomWebhookConnector implements ImConnector {
  readonly platform = 'wecom-webhook'
  private running = false

  constructor(private key: string) {}

  async start(): Promise<void> {
    this.running = true
  }

  stop(): void {
    this.running = false
  }

  isRunning(): boolean {
    return this.running
  }

  async sendMessage(_chatId: string, text: string): Promise<void> {
    const url = `https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=${this.key}`
    await this.postJson(url, {
      msgtype: 'text',
      text: { content: text }
    })
  }

  async sendCard(_chatId: string, card: ImCard): Promise<void> {
    const url = `https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=${this.key}`
    await this.postJson(url, {
      msgtype: 'markdown',
      markdown: {
        content: `### ${card.title}\n${card.body}`
      }
    })
  }

  private postJson(url: string, data: unknown): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = net.request({ method: 'POST', url })
      request.setHeader('Content-Type', 'application/json')
      request.on('response', (response) => {
        response.on('data', () => {})
        response.on('end', () => resolve())
      })
      request.on('error', reject)
      request.write(JSON.stringify(data))
      request.end()
    })
  }
}
