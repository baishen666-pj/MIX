import type { LocaleMessages } from './types'

export const en: LocaleMessages = {
  app: {
    title: 'AI GUI',
    subtitle: 'Multi-Agent Desktop Workbench'
  },
  sidebar: {
    chat: 'Chat',
    canvas: 'Agent Canvas',
    memory: 'Memory',
    tools: 'Tools',
    settings: 'Settings',
    computerUse: 'Computer Use',
    im: 'IM'
  },
  chat: {
    placeholder: 'Type a message, / for commands...',
    send: 'Send',
    newChat: 'New Chat',
    thinking: 'Thinking...'
  },
  settings: {
    title: 'Settings',
    language: 'Language',
    connection: 'Connection',
    model: 'Model Config',
    local: 'Local Mode',
    remote: 'Remote Mode',
    save: 'Save'
  },
  provider: {
    deepseek: 'DeepSeek',
    discoverModels: 'Discover Models',
    discovering: 'Discovering...',
    discoverFailed: 'No results',
    discoverDone: 'Discovered',
    switchModel: 'Switch Model',
    switchProvider: 'Switch Provider',
    subscription: {
      login: 'Login',
      logging: 'Waiting for login...',
      logout: 'Logout',
      loggedIn: 'Logged in',
      loginFailed: 'Login failed, please retry',
      description: 'Login with your subscription, no API Key needed'
    },
    hermes: {
      gatewayRunning: 'Gateway Running',
      gatewayStopped: 'Gateway Stopped',
      gatewayStarting: 'Starting...',
      gatewayStopping: 'Stopping...',
      startGateway: 'Start Gateway',
      stopGateway: 'Stop Gateway',
      readApiKey: 'Read Key from Config',
      apiKeyRead: 'Key Read',
      apiKeyNotFound: 'Key Not Found',
      cliNotAvailable: 'Hermes CLI not found',
      localAgent: 'Local Agent · OpenAI Compatible'
    }
  },
  common: {
    loading: 'Loading...',
    error: 'Error',
    retry: 'Retry',
    cancel: 'Cancel'
  }
}
