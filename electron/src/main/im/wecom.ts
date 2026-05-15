import { net } from 'electron'
import type { ImConnector, ImCard, ImMessage } from './types'
import { dispatchMessage } from './registry'

interface WecomConfig {
  corpId: string
  corpSecret: string
  agentId: number
}

export class WecomConnector implements ImConnector {
  readonly platform = 'wecom'
  private running = false
  private accessToken: string = ''
  private tokenExpiry = 0

  constructor(private config: WecomConfig) {}

  async start(): Promise<void> {
    await this.refreshToken()
    this.running = true
  }

  stop(): void {
    this.running = false
    this.accessToken = ''
  }

  isRunning(): boolean {
    return this.running
  }

  private async refreshToken(): Promise<void> {
    const url = `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${encodeURIComponent(this.config.corpId)}&corpsecret=${encodeURIComponent(this.config.corpSecret)}`
    const data = await this.fetchJson(url)
    if (data.errcode === 0) {
      this.accessToken = data.access_token as string
      this.tokenExpiry = Date.now() + ((data.expires_in as number) - 300) * 1000
    } else {
      throw new Error(`WeCom auth failed: ${data.errmsg}`)
    }
  }

  private async ensureToken(): Promise<void> {
    if (Date.now() >= this.tokenExpiry) {
      await this.refreshToken()
    }
  }

  async sendMessage(userId: string, text: string): Promise<void> {
    await this.ensureToken()
    const url = `https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${this.accessToken}`
    await this.fetchJson(url, {
      touser: userId,
      msgtype: 'text',
      agentid: this.config.agentId,
      text: { content: text }
    })
  }

  async sendCard(userId: string, card: ImCard): Promise<void> {
    await this.ensureToken()
    const url = `https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${this.accessToken}`

    const markdownContent = `### ${card.title}\n${card.body}`
    await this.fetchJson(url, {
      touser: userId,
      msgtype: 'markdown',
      agentid: this.config.agentId,
      markdown: { content: markdownContent }
    })
  }

  async sendImage(userId: string, base64: string): Promise<void> {
    await this.ensureToken()

    // Upload image to get media_id
    const uploadUrl = `https://qyapi.weixin.qq.com/cgi-bin/media/upload?access_token=${this.accessToken}&type=image`
    const buffer = Buffer.from(base64, 'base64')

    const mediaResult = await new Promise<Record<string, unknown>>((resolve, reject) => {
      const boundary = '----FormBoundary' + Date.now()
      const request = net.request({ method: 'POST', url: uploadUrl })
      request.setHeader('Content-Type', `multipart/form-data; boundary=${boundary}`)

      let body = ''
      request.on('response', (response) => {
        response.on('data', (chunk: Buffer) => { body += chunk.toString() })
        response.on('end', () => {
          try { resolve(JSON.parse(body)) } catch { reject(new Error('Parse error')) }
        })
      })
      request.on('error', reject)

      const payload = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="media"; filename="image.png"',
        'Content-Type: image/png',
        '',
        ''
      ].join('\r\n')
      const suffix = `\r\n--${boundary}--\r\n`

      request.write(payload)
      request.write(buffer)
      request.write(suffix)
      request.end()
    })

    const mediaId = mediaResult.media_id as string
    if (!mediaId) return

    const url = `https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${this.accessToken}`
    await this.fetchJson(url, {
      touser: userId,
      msgtype: 'image',
      agentid: this.config.agentId,
      image: { media_id: mediaId }
    })
  }

  private fetchJson(url: string, body?: unknown): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      const opts: Record<string, unknown> = { method: body ? 'POST' : 'GET', url }
      const request = net.request(opts)
      if (body) request.setHeader('Content-Type', 'application/json')

      let data = ''
      request.on('response', (response) => {
        response.on('data', (chunk: Buffer) => { data += chunk.toString() })
        response.on('end', () => {
          try { resolve(JSON.parse(data)) } catch { resolve({}) }
        })
      })
      request.on('error', reject)
      if (body) request.write(JSON.stringify(body))
      request.end()
    })
  }
}
