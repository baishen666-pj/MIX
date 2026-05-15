import { create } from 'zustand'
import { genId } from '../lib/genId'
import type { ChatMessage, ViewMode, ToolCall, ToolResult } from '../../../shared/types'
import type { DangerCategory } from '../lib/approvalDetection'

export interface ChatApprovalRequest {
  id: string
  messageId: string
  content: string
  category: DangerCategory
  summary: string
  confidence: 'high' | 'medium'
  matchedPattern: string | null
  status: 'pending' | 'approved' | 'rejected'
  createdAt: number
}

export interface TabState {
  sessionId: string
  title: string
  messages: ChatMessage[]
  isLoading: boolean
  toolProgress: string | null
  reasoningContent: string
  chatApproval: ChatApprovalRequest | null
  activeToolCalls: ToolCall[]
  toolResults: ToolResult[]
}

function createEmptyTab(sessionId: string, title?: string): TabState {
  return {
    sessionId,
    title: title || '新对话',
    messages: [],
    isLoading: false,
    toolProgress: null,
    reasoningContent: '',
    chatApproval: null,
    activeToolCalls: [],
    toolResults: []
  }
}

function updateTabInList(tabs: TabState[], sessionId: string, patch: Partial<TabState>): TabState[] {
  return tabs.map(t => t.sessionId === sessionId ? { ...t, ...patch } : t)
}

interface ChatState {
  view: ViewMode
  isAiConfigMode: boolean
  tabs: TabState[]
  activeTabId: string | null

  // Tab management
  openTab: (sessionId?: string, title?: string) => string
  closeTab: (sessionId: string) => void
  switchTab: (sessionId: string) => void
  updateTab: (sessionId: string, patch: Partial<TabState>) => void

  // Convenience getters (operate on active tab)
  getActiveTab: () => TabState | undefined

  // Legacy-compatible actions (operate on active tab)
  setView: (view: ViewMode) => void
  addMessage: (msg: ChatMessage) => void
  appendToLastAgent: (chunk: string) => void
  setLoading: (loading: boolean) => void
  setToolProgress: (tool: string | null) => void
  setSessionId: (id: string | null) => void
  appendReasoning: (text: string) => void
  clearReasoning: () => void
  clearMessages: () => void
  setAiConfigMode: (mode: boolean) => void
  submitChatApproval: (req: Omit<ChatApprovalRequest, 'id' | 'status' | 'createdAt'>) => void
  respondChatApproval: (approved: boolean) => void
  addToolCall: (call: ToolCall) => void
  updateToolCallArguments: (id: string, chunk: string) => void
  addToolResult: (result: ToolResult) => void
  clearToolCalls: () => void
}

export const useChatStore = create<ChatState>((set, get) => ({
  view: 'chat',
  isAiConfigMode: false,
  tabs: [],
  activeTabId: null,

  // Tab management
  openTab: (sessionId, title) => {
    const id = sessionId || genId('session-')
    const existing = get().tabs.find(t => t.sessionId === id)
    if (existing) {
      set({ activeTabId: id })
      return id
    }
    const tab = createEmptyTab(id, title)
    set(s => ({
      tabs: [...s.tabs, tab],
      activeTabId: id
    }))
    return id
  },

  closeTab: (sessionId) => {
    set(s => {
      const idx = s.tabs.findIndex(t => t.sessionId === sessionId)
      if (idx === -1) return {}
      const newTabs = s.tabs.filter(t => t.sessionId !== sessionId)
      let newActiveId = s.activeTabId
      if (s.activeTabId === sessionId) {
        // Switch to adjacent tab
        const nextTab = newTabs[Math.min(idx, newTabs.length - 1)]
        newActiveId = nextTab?.sessionId ?? null
      }
      return { tabs: newTabs, activeTabId: newActiveId }
    })
  },

  switchTab: (sessionId) => {
    set({ activeTabId: sessionId })
  },

  updateTab: (sessionId, patch) => {
    set(s => ({ tabs: updateTabInList(s.tabs, sessionId, patch) }))
  },

  getActiveTab: () => {
    const s = get()
    return s.tabs.find(t => t.sessionId === s.activeTabId)
  },

  // Legacy-compatible actions (route to active tab)
  setView: (view) => set({ view }),

  addMessage: (msg) => {
    const { activeTabId, tabs } = get()
    if (!activeTabId) return
    set({ tabs: updateTabInList(tabs, activeTabId, {
      messages: [...(tabs.find(t => t.sessionId === activeTabId)?.messages ?? []), msg]
    })})
  },

  appendToLastAgent: (chunk) => {
    const { activeTabId, tabs } = get()
    if (!activeTabId) return
    const tab = tabs.find(t => t.sessionId === activeTabId)
    if (!tab) return
    const msgs = [...tab.messages]
    const last = msgs[msgs.length - 1]
    if (last?.role === 'agent') {
      msgs[msgs.length - 1] = { ...last, content: last.content + chunk }
      set({ tabs: updateTabInList(tabs, activeTabId, { messages: msgs }) })
    } else {
      set({ tabs: updateTabInList(tabs, activeTabId, {
        messages: [...msgs, { id: genId('agent-'), role: 'agent', content: chunk, timestamp: Date.now() }]
      })})
    }
  },

  setLoading: (isLoading) => {
    const { activeTabId, tabs } = get()
    if (!activeTabId) return
    set({ tabs: updateTabInList(tabs, activeTabId, { isLoading }) })
  },

  setToolProgress: (toolProgress) => {
    const { activeTabId, tabs } = get()
    if (!activeTabId) return
    set({ tabs: updateTabInList(tabs, activeTabId, { toolProgress }) })
  },

  setSessionId: (id) => {
    if (id) {
      const { tabs } = get()
      const existing = tabs.find(t => t.sessionId === id)
      if (existing) {
        set({ activeTabId: id })
      } else {
        const tab = createEmptyTab(id)
        set(s => ({ tabs: [...s.tabs, tab], activeTabId: id }))
      }
    }
  },

  appendReasoning: (text) => {
    const { activeTabId, tabs } = get()
    if (!activeTabId) return
    const tab = tabs.find(t => t.sessionId === activeTabId)
    if (!tab) return
    set({ tabs: updateTabInList(tabs, activeTabId, { reasoningContent: tab.reasoningContent + text }) })
  },

  clearReasoning: () => {
    const { activeTabId, tabs } = get()
    if (!activeTabId) return
    set({ tabs: updateTabInList(tabs, activeTabId, { reasoningContent: '' }) })
  },

  clearMessages: () => {
    const { activeTabId, tabs } = get()
    if (!activeTabId) return
    set({ tabs: updateTabInList(tabs, activeTabId, {
      messages: [], isLoading: false, toolProgress: null, reasoningContent: '',
      chatApproval: null, activeToolCalls: [], toolResults: []
    })})
  },

  setAiConfigMode: (mode) => set({ isAiConfigMode: mode }),

  submitChatApproval: (req) => {
    const { activeTabId, tabs } = get()
    if (!activeTabId) return
    set({ tabs: updateTabInList(tabs, activeTabId, {
      chatApproval: {
        ...req,
        id: genId('chat-approval-'),
        status: 'pending' as const,
        createdAt: Date.now()
      }
    })})
  },

  respondChatApproval: (approved) => {
    const { activeTabId, tabs } = get()
    if (!activeTabId) return
    const tab = tabs.find(t => t.sessionId === activeTabId)
    if (!tab?.chatApproval) return
    set({ tabs: updateTabInList(tabs, activeTabId, {
      chatApproval: { ...tab.chatApproval, status: approved ? 'approved' as const : 'rejected' as const }
    })})
  },

  addToolCall: (call) => {
    const { activeTabId, tabs } = get()
    if (!activeTabId) return
    const tab = tabs.find(t => t.sessionId === activeTabId)
    if (!tab) return
    set({ tabs: updateTabInList(tabs, activeTabId, { activeToolCalls: [...tab.activeToolCalls, call] }) })
  },

  updateToolCallArguments: (id, chunk) => {
    const { activeTabId, tabs } = get()
    if (!activeTabId) return
    const tab = tabs.find(t => t.sessionId === activeTabId)
    if (!tab) return
    set({ tabs: updateTabInList(tabs, activeTabId, {
      activeToolCalls: tab.activeToolCalls.map(tc => tc.id === id ? { ...tc, arguments: tc.arguments + chunk } : tc)
    })})
  },

  addToolResult: (result) => {
    const { activeTabId, tabs } = get()
    if (!activeTabId) return
    const tab = tabs.find(t => t.sessionId === activeTabId)
    if (!tab) return
    set({ tabs: updateTabInList(tabs, activeTabId, { toolResults: [...tab.toolResults, result] }) })
  },

  clearToolCalls: () => {
    const { activeTabId, tabs } = get()
    if (!activeTabId) return
    set({ tabs: updateTabInList(tabs, activeTabId, { activeToolCalls: [], toolResults: [] }) })
  }
}))
