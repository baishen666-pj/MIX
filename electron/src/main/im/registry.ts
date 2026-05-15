import type { ImConnector, ImConnectorStatus, MessageHandler } from './types'

const connectors = new Map<string, ImConnector>()
let messageHandler: MessageHandler | null = null

export function registerConnector(connector: ImConnector): void {
  connectors.set(connector.platform, connector)
}

export function getConnector(platform: string): ImConnector | undefined {
  return connectors.get(platform)
}

export function getAllConnectors(): ImConnector[] {
  return Array.from(connectors.values())
}

export function getConnectorStatuses(): ImConnectorStatus[] {
  return Array.from(connectors.values()).map((c) => ({
    platform: c.platform,
    running: c.isRunning()
  }))
}

export function setMessageHandler(handler: MessageHandler): void {
  messageHandler = handler
}

export function dispatchMessage(message: import('./types').ImMessage): void {
  if (messageHandler) {
    messageHandler(message)
  }
}

export async function startConnector(platform: string): Promise<boolean> {
  const connector = connectors.get(platform)
  if (!connector) return false
  try {
    await connector.start()
    return true
  } catch {
    return false
  }
}

export function stopConnector(platform: string): void {
  const connector = connectors.get(platform)
  if (connector) connector.stop()
}

export function stopAll(): void {
  for (const connector of connectors.values()) {
    connector.stop()
  }
}
