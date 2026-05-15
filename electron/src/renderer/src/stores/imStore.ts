import { create } from 'zustand'

interface ImMessage {
  platform: string
  chatId: string
  userId: string
  text: string
  timestamp: number
}

interface ImConnectorState {
  platform: string
  running: boolean
}

interface ImState {
  connectors: ImConnectorState[]
  messages: ImMessage[]
  addMessage: (msg: ImMessage) => void
  setConnectors: (connectors: ImConnectorState[]) => void
  clearMessages: () => void
}

export const useImStore = create<ImState>((set) => ({
  connectors: [],
  messages: [],
  addMessage: (msg) => set((s) => ({
    messages: [...s.messages.slice(-49), msg]
  })),
  setConnectors: (connectors) => set({ connectors }),
  clearMessages: () => set({ messages: [] })
}))
