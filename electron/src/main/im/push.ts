import { getAllConnectors } from './registry'
import type { ImCard } from './types'

export function pushNotification(title: string, body: string, buttons?: import('./types').ImButton[]): void {
  const connectors = getAllConnectors()
  const card: ImCard = { title, body, buttons }

  for (const connector of connectors) {
    if (!connector.isRunning()) continue
    connector.sendMessage('', `[${title}] ${body}`).catch(() => {})
  }
}

export function pushToPlatform(platform: string, chatId: string, text: string): void {
  const { getConnector } = require('./registry')
  const connector = getConnector(platform) as import('./types').ImConnector | undefined
  if (connector?.isRunning()) {
    connector.sendMessage(chatId, text).catch(() => {})
  }
}
