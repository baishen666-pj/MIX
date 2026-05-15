import { describe, it, expect, beforeEach } from 'vitest'
import { useChatStore } from '../chatStore'

function getActive() {
  return useChatStore.getState().getActiveTab()
}

function resetStore() {
  useChatStore.setState({
    tabs: [],
    activeTabId: null,
    view: 'chat',
    isAiConfigMode: false
  })
}

describe('chatStore', () => {
  beforeEach(() => {
    resetStore()
    useChatStore.getState().openTab('sess-test', 'Test')
  })

  describe('initial state', () => {
    it('has default values', () => {
      const s = useChatStore.getState()
      expect(s.view).toBe('chat')
      expect(s.isAiConfigMode).toBe(false)
      const tab = getActive()
      expect(tab).toBeDefined()
      expect(tab!.messages).toEqual([])
      expect(tab!.isLoading).toBe(false)
      expect(tab!.toolProgress).toBeNull()
      expect(tab!.reasoningContent).toBe('')
      expect(tab!.chatApproval).toBeNull()
    })
  })

  describe('setView', () => {
    it('changes view', () => {
      useChatStore.getState().setView('canvas')
      expect(useChatStore.getState().view).toBe('canvas')
    })
  })

  describe('addMessage', () => {
    it('adds a message', () => {
      useChatStore.getState().addMessage({ id: '1', role: 'user', content: 'hello', timestamp: 1 })
      expect(getActive()!.messages).toHaveLength(1)
      expect(getActive()!.messages[0].content).toBe('hello')
    })

    it('appends multiple messages', () => {
      useChatStore.getState().addMessage({ id: '1', role: 'user', content: 'a', timestamp: 1 })
      useChatStore.getState().addMessage({ id: '2', role: 'agent', content: 'b', timestamp: 2 })
      expect(getActive()!.messages).toHaveLength(2)
    })
  })

  describe('appendToLastAgent', () => {
    it('appends to existing agent message', () => {
      useChatStore.getState().addMessage({ id: '1', role: 'agent', content: 'hello', timestamp: 1 })
      useChatStore.getState().appendToLastAgent(' world')
      expect(getActive()!.messages[0].content).toBe('hello world')
    })

    it('creates new agent message when last is user', () => {
      useChatStore.getState().addMessage({ id: '1', role: 'user', content: 'hello', timestamp: 1 })
      useChatStore.getState().appendToLastAgent('response')
      expect(getActive()!.messages).toHaveLength(2)
      expect(getActive()!.messages[1].role).toBe('agent')
    })

    it('creates new agent message when empty', () => {
      useChatStore.getState().appendToLastAgent('start')
      expect(getActive()!.messages).toHaveLength(1)
      expect(getActive()!.messages[0].content).toBe('start')
    })
  })

  describe('setLoading / setToolProgress / setSessionId', () => {
    it('sets loading state', () => {
      useChatStore.getState().setLoading(true)
      expect(getActive()!.isLoading).toBe(true)
    })

    it('sets tool progress', () => {
      useChatStore.getState().setToolProgress('searching...')
      expect(getActive()!.toolProgress).toBe('searching...')
    })

    it('setSessionId opens or switches to a tab', () => {
      useChatStore.getState().setSessionId('sess-other')
      expect(useChatStore.getState().activeTabId).toBe('sess-other')
    })
  })

  describe('reasoning', () => {
    it('appends reasoning content', () => {
      useChatStore.getState().appendReasoning('step 1')
      useChatStore.getState().appendReasoning(' step 2')
      expect(getActive()!.reasoningContent).toBe('step 1 step 2')
    })

    it('clears reasoning', () => {
      useChatStore.getState().appendReasoning('some text')
      useChatStore.getState().clearReasoning()
      expect(getActive()!.reasoningContent).toBe('')
    })
  })

  describe('clearMessages', () => {
    it('resets all chat state', () => {
      useChatStore.getState().addMessage({ id: '1', role: 'user', content: 'hello', timestamp: 1 })
      useChatStore.getState().setLoading(true)
      useChatStore.getState().setToolProgress('working')
      useChatStore.getState().appendReasoning('thinking')
      useChatStore.getState().submitChatApproval({
        messageId: '1', content: 'rm -rf', category: 'file_delete',
        summary: 'danger', confidence: 'high', matchedPattern: 'rm -rf',
      })
      useChatStore.getState().clearMessages()
      const tab = getActive()
      expect(tab!.messages).toEqual([])
      expect(tab!.isLoading).toBe(false)
      expect(tab!.toolProgress).toBeNull()
      expect(tab!.reasoningContent).toBe('')
      expect(tab!.chatApproval).toBeNull()
    })
  })

  describe('setAiConfigMode', () => {
    it('toggles AI config mode', () => {
      useChatStore.getState().setAiConfigMode(true)
      expect(useChatStore.getState().isAiConfigMode).toBe(true)
      useChatStore.getState().setAiConfigMode(false)
      expect(useChatStore.getState().isAiConfigMode).toBe(false)
    })
  })

  describe('chatApproval', () => {
    it('submits a chat approval request', () => {
      useChatStore.getState().submitChatApproval({
        messageId: '1', content: 'rm -rf /', category: 'file_delete',
        summary: 'force delete', confidence: 'high', matchedPattern: 'rm -rf',
      })
      const a = getActive()!.chatApproval!
      expect(a).toBeDefined()
      expect(a.status).toBe('pending')
      expect(a.category).toBe('file_delete')
      expect(a.id).toBeTruthy()
    })

    it('responds to approval (approved)', () => {
      useChatStore.getState().submitChatApproval({
        messageId: '1', content: 'test', category: 'shell_exec',
        summary: 'test', confidence: 'medium', matchedPattern: 'test',
      })
      useChatStore.getState().respondChatApproval(true)
      expect(getActive()!.chatApproval!.status).toBe('approved')
    })

    it('responds to approval (rejected)', () => {
      useChatStore.getState().submitChatApproval({
        messageId: '1', content: 'test', category: 'shell_exec',
        summary: 'test', confidence: 'medium', matchedPattern: 'test',
      })
      useChatStore.getState().respondChatApproval(false)
      expect(getActive()!.chatApproval!.status).toBe('rejected')
    })

    it('no-ops respond when no approval exists', () => {
      useChatStore.getState().respondChatApproval(true)
      expect(getActive()!.chatApproval).toBeNull()
    })
  })

  describe('toolCall state', () => {
    beforeEach(() => {
      useChatStore.getState().clearToolCalls()
    })

    it('addToolCall adds to activeToolCalls', () => {
      useChatStore.getState().addToolCall({ id: 'tc-1', name: 'read_file', arguments: '{"path":"/tmp/a"}' })
      expect(getActive()!.activeToolCalls).toEqual([
        { id: 'tc-1', name: 'read_file', arguments: '{"path":"/tmp/a"}' }
      ])
    })

    it('updateToolCallArguments appends arguments chunk to matching tool call', () => {
      useChatStore.getState().addToolCall({ id: 'tc-1', name: 'read_file', arguments: '' })
      useChatStore.getState().updateToolCallArguments('tc-1', '{"path')
      useChatStore.getState().updateToolCallArguments('tc-1', '":"/tmp/a"}')
      expect(getActive()!.activeToolCalls).toEqual([
        { id: 'tc-1', name: 'read_file', arguments: '{"path":"/tmp/a"}' }
      ])
    })

    it('updateToolCallArguments ignores non-matching id', () => {
      useChatStore.getState().addToolCall({ id: 'tc-1', name: 'read_file', arguments: 'original' })
      useChatStore.getState().updateToolCallArguments('tc-999', 'extra')
      expect(getActive()!.activeToolCalls).toEqual([
        { id: 'tc-1', name: 'read_file', arguments: 'original' }
      ])
    })

    it('addToolResult adds to toolResults', () => {
      useChatStore.getState().addToolResult({ toolCallId: 'tc-1', name: 'read_file', result: 'file contents', ok: true })
      expect(getActive()!.toolResults).toEqual([
        { toolCallId: 'tc-1', name: 'read_file', result: 'file contents', ok: true }
      ])
    })

    it('clearToolCalls resets both activeToolCalls and toolResults', () => {
      useChatStore.getState().addToolCall({ id: 'tc-1', name: 'read_file', arguments: '{}' })
      useChatStore.getState().addToolResult({ toolCallId: 'tc-1', name: 'read_file', result: 'ok', ok: true })
      useChatStore.getState().clearToolCalls()
      expect(getActive()!.activeToolCalls).toEqual([])
      expect(getActive()!.toolResults).toEqual([])
    })

    it('clearMessages also resets activeToolCalls and toolResults', () => {
      useChatStore.getState().addToolCall({ id: 'tc-2', name: 'write_file', arguments: '{}' })
      useChatStore.getState().addToolResult({ toolCallId: 'tc-2', name: 'write_file', result: 'done', ok: true })
      useChatStore.getState().clearMessages()
      expect(getActive()!.activeToolCalls).toEqual([])
      expect(getActive()!.toolResults).toEqual([])
    })
  })

  describe('tab management', () => {
    it('openTab creates a new tab and sets it active', () => {
      resetStore()
      const id = useChatStore.getState().openTab('sess-1', 'Tab 1')
      expect(id).toBe('sess-1')
      expect(useChatStore.getState().activeTabId).toBe('sess-1')
      const tab = useChatStore.getState().getActiveTab()
      expect(tab!.title).toBe('Tab 1')
    })

    it('openTab switches to existing tab if sessionId matches', () => {
      resetStore()
      useChatStore.getState().openTab('sess-1', 'First')
      useChatStore.getState().openTab('sess-2', 'Second')
      useChatStore.getState().openTab('sess-1', 'First')
      expect(useChatStore.getState().activeTabId).toBe('sess-1')
      expect(useChatStore.getState().tabs).toHaveLength(2)
    })

    it('closeTab removes tab and switches to adjacent', () => {
      resetStore()
      useChatStore.getState().openTab('sess-1', 'A')
      useChatStore.getState().openTab('sess-2', 'B')
      useChatStore.getState().closeTab('sess-2')
      expect(useChatStore.getState().tabs).toHaveLength(1)
      expect(useChatStore.getState().activeTabId).toBe('sess-1')
    })

    it('switchTab changes active tab', () => {
      resetStore()
      useChatStore.getState().openTab('sess-1', 'A')
      useChatStore.getState().openTab('sess-2', 'B')
      useChatStore.getState().switchTab('sess-1')
      expect(useChatStore.getState().activeTabId).toBe('sess-1')
    })

    it('actions no-op when no active tab', () => {
      resetStore()
      useChatStore.getState().addMessage({ id: '1', role: 'user', content: 'x', timestamp: 1 })
      expect(useChatStore.getState().tabs).toHaveLength(0)
    })
  })
})
