export interface ImConnector {
  readonly platform: string
  start(): Promise<void>
  stop(): void
  sendMessage(chatId: string, text: string): Promise<void>
  sendCard(chatId: string, card: ImCard): Promise<void>
  sendImage?(chatId: string, base64: string): Promise<void>
  isRunning(): boolean
}

export interface ImMessage {
  platform: string
  chatId: string
  userId: string
  text: string
  timestamp: number
}

export interface ImCard {
  title: string
  body: string
  buttons?: ImButton[]
}

export interface ImButton {
  text: string
  action: string
  value: string
}

export type ImConfig =
  | { platform: 'feishu'; appId: string; appSecret: string }
  | { platform: 'wecom'; corpId: string; corpSecret: string; agentId: number }
  | { platform: 'wecom-webhook'; key: string }

export type ImConfigSet = ImConfig[]

export interface ImConnectorStatus {
  platform: string
  running: boolean
}

export type MessageHandler = (message: ImMessage) => void
