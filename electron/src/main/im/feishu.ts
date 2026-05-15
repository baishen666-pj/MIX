import * as Lark from '@larksuiteoapi/node-sdk'
import type { ImConnector, ImCard, ImMessage } from './types'
import { dispatchMessage } from './registry'

interface FeishuConfig {
  appId: string
  appSecret: string
}

export class FeishuConnector implements ImConnector {
  readonly platform = 'feishu'
  private client: Lark.Client | null = null
  private wsClient: Lark.WSClient | null = null
  private running = false

  constructor(private config: FeishuConfig) {}

  async start(): Promise<void> {
    this.client = new Lark.Client({
      appId: this.config.appId,
      appSecret: this.config.appSecret
    })

    this.wsClient = new Lark.WSClient({
      appId: this.config.appId,
      appSecret: this.config.appSecret,
      loggerLevel: Lark.LoggerLevel.info
    })

    const dispatcher = new Lark.EventDispatcher({}).register({
      'im.message.receive_v1': async (data: Record<string, unknown>) => {
        const msg = data as { message: { chat_id: string; content: string; message_id: string; sender: { sender_id: { user_id: string } } } }
        let text = ''
        try {
          const content = JSON.parse(msg.message.content)
          text = content.text || ''
        } catch {
          text = String(msg.message.content)
        }

        if (!text.trim()) return

        const imMessage: ImMessage = {
          platform: 'feishu',
          chatId: msg.message.chat_id,
          userId: msg.message.sender?.sender_id?.user_id || '',
          text,
          timestamp: Date.now()
        }

        dispatchMessage(imMessage)
      }
    })

    this.wsClient.start({ eventDispatcher: dispatcher })
    this.running = true
  }

  stop(): void {
    this.running = false
    this.client = null
    this.wsClient = null
  }

  isRunning(): boolean {
    return this.running
  }

  async sendMessage(chatId: string, text: string): Promise<void> {
    if (!this.client) throw new Error('Connector not started')
    await this.client.im.v1.message.create({
      params: { receive_id_type: 'chat_id' },
      data: {
        receive_id: chatId,
        msg_type: 'text',
        content: JSON.stringify({ text })
      }
    })
  }

  async sendCard(chatId: string, card: ImCard): Promise<void> {
    if (!this.client) throw new Error('Connector not started')

    const elements: Record<string, unknown>[] = [
      { tag: 'markdown', content: card.body }
    ]

    if (card.buttons && card.buttons.length > 0) {
      elements.push({
        tag: 'action',
        actions: card.buttons.map((btn) => ({
          tag: 'button',
          text: { tag: 'plain_text', content: btn.text },
          type: 'primary',
          value: { action: btn.action, value: btn.value }
        }))
      })
    }

    await this.client.im.v1.message.create({
      params: { receive_id_type: 'chat_id' },
      data: {
        receive_id: chatId,
        msg_type: 'interactive',
        content: JSON.stringify({
          schema: '2.0',
          config: { wide_screen_mode: true },
          header: {
            title: { tag: 'plain_text', content: card.title },
            template: 'blue'
          },
          body: { elements }
        })
      }
    })
  }

  async sendImage(chatId: string, base64: string): Promise<void> {
    if (!this.client) throw new Error('Connector not started')
    const buffer = Buffer.from(base64, 'base64')

    const uploadResult = await this.client.im.v1.image.create({
      data: {
        image_type: 'message',
        image: buffer
      }
    })

    if (uploadResult?.image_key) {
      await this.client.im.v1.message.create({
        params: { receive_id_type: 'chat_id' },
        data: {
          receive_id: chatId,
          msg_type: 'image',
          content: JSON.stringify({ image_key: uploadResult.image_key })
        }
      })
    }
  }
}
