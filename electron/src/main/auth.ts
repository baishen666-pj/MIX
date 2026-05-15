import { BrowserWindow, session } from 'electron'
import { getActiveProvider, updateProvider } from './config'
import type { ChatGPTSession } from '../shared/types'

export type { ChatGPTSession }

export interface SubscriptionLoginOptions {
  loginUrl: string
  windowTitle: string
  cookieDomain: string
  sessionCookieName: string
  sessionEndpoint: string
  tokenExtractor: (data: Record<string, unknown>) => string | null
  partition: string
}

let loginWindow: BrowserWindow | null = null

export function openSubscriptionLogin(opts: SubscriptionLoginOptions): Promise<{ accessToken: string }> {
  return new Promise((resolve, reject) => {
    if (loginWindow && !loginWindow.isDestroyed()) {
      loginWindow.focus()
      reject(new Error('登录窗口已打开'))
      return
    }

    loginWindow = new BrowserWindow({
      width: 800,
      height: 700,
      title: opts.windowTitle,
      webPreferences: {
        partition: opts.partition,
        nodeIntegration: false,
        contextIsolation: true
      }
    })

    loginWindow.loadURL(opts.loginUrl)

    const pollSession = async () => {
      if (!loginWindow || loginWindow.isDestroyed()) return

      try {
        const ses = loginWindow.webContents.session
        const cookies = await ses.cookies.get({ domain: opts.cookieDomain })

        const hasSession = cookies.some((c) => c.name === opts.sessionCookieName)
        if (!hasSession) {
          setTimeout(pollSession, 2000)
          return
        }

        const response = await ses.fetch(opts.sessionEndpoint, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        })

        if (!response.ok) {
          setTimeout(pollSession, 2000)
          return
        }

        const data = await response.json() as Record<string, unknown>
        const token = opts.tokenExtractor(data)
        if (!token) {
          setTimeout(pollSession, 2000)
          return
        }

        const provider = getActiveProvider()
        if (provider.authType === 'subscription' || provider.type === 'chatgpt') {
          updateProvider({ ...provider, apiKey: token })
        }

        loginWindow.close()
        loginWindow = null
        resolve({ accessToken: token })
      } catch {
        setTimeout(pollSession, 2000)
      }
    }

    loginWindow.on('closed', () => {
      loginWindow = null
    })

    loginWindow.webContents.on('did-finish-load', () => {
      setTimeout(pollSession, 1500)
    })
  })
}

export function openChatGPTLogin(): Promise<ChatGPTSession> {
  return openSubscriptionLogin({
    loginUrl: 'https://chatgpt.com/auth/login',
    windowTitle: '登录 ChatGPT',
    cookieDomain: '.chatgpt.com',
    sessionCookieName: '__Secure-next-auth.session-token',
    sessionEndpoint: 'https://chatgpt.com/api/auth/session',
    tokenExtractor: (data) => (data as unknown as ChatGPTSession).accessToken ?? null,
    partition: 'chatgpt-auth'
  }) as Promise<ChatGPTSession>
}

export async function getChatGPTSession(): Promise<string | null> {
  const provider = getActiveProvider()
  if (provider.type !== 'chatgpt' && provider.authType !== 'subscription') return null
  return provider.apiKey || null
}

export function logoutChatGPT(): Promise<void> {
  return new Promise((resolve) => {
    const partition = session.fromPartition('chatgpt-auth')
    partition.clearStorageData().then(() => resolve()).catch(() => resolve())
  })
}

export function logoutSubscription(partition: string): Promise<void> {
  return new Promise((resolve) => {
    const ses = session.fromPartition(partition)
    ses.clearStorageData().then(() => resolve()).catch(() => resolve())
  })
}
