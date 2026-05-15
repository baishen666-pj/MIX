import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { ChatApprovalRequest } from '../../stores/app'

/**
 * Note: useApprovalHandler depends on React (useRef, useEffect, useCallback),
 * window.mixDesktop, and useAppStore. Since @testing-library/react is not available
 * in this project, we test the hook's core logic by extracting and calling
 * the internal callbacks directly through a lightweight React mock.
 *
 * We mock React hooks to simulate the hook's behavior without a real renderer.
 */

const state: Record<string, unknown> = {
  sessionId: 'session-1',
  soulPrompt: '',
  messages: [],
  chatApproval: null,
}

vi.mock('../../stores/app', () => ({
  useAppStore: {
    getState: () => state,
    setState: vi.fn((patch: Record<string, unknown>) => Object.assign(state, patch)),
  },
}))

vi.mock('../../lib/approvalDetection', () => ({
  CATEGORY_LABELS: {
    file_delete: '文件删除',
    shell_exec: '命令执行',
    db_destructive: '数据库操作',
    system_modify: '系统修改',
    deploy_publish: '部署发布',
    env_secret: '密钥/环境变量',
    mass_change: '批量变更',
  },
}))

// Ensure window/globalThis exists for the source module
if (typeof globalThis.window === 'undefined') {
  (globalThis as Record<string, unknown>).window = globalThis
}

// Mock React hooks to capture and exercise callback logic
let refStore: Record<string, { current: unknown }> = {}
let effectQueue: Array<() => void | (() => void)> = []

vi.mock('react', () => ({
  useRef: <T>(initial: T) => {
    const key = String(initial)
    if (!refStore[key]) refStore[key] = { current: initial }
    return refStore[key] as { current: T }
  },
  useEffect: (fn: () => void | (() => void)) => { effectQueue.push(fn) },
  useCallback: (fn: (...args: unknown[]) => unknown) => fn,
}))

function runEffects() {
  for (const effect of effectQueue) {
    effect()
  }
  effectQueue = []
}

function makeApproval(status: 'pending' | 'approved' | 'rejected'): ChatApprovalRequest {
  return {
    id: 'approval-1',
    messageId: 'msg-1',
    content: 'rm -rf /tmp/test',
    category: 'file_delete',
    summary: '强制删除文件',
    confidence: 'high',
    matchedPattern: 'rm -rf',
    status,
    createdAt: Date.now(),
  }
}

describe('useApprovalHandler', () => {
  const addMessage = vi.fn()
  const setLoading = vi.fn()
  const isStreamingRef = { current: false }
  const agentBufferRef = { current: '' }
  let chatSendMock: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    addMessage.mockReset()
    setLoading.mockReset()
    refStore = {}
    effectQueue = []
    state.sessionId = 'session-1'
    state.soulPrompt = ''
    state.messages = []
    state.chatApproval = null

    chatSendMock = vi.fn().mockResolvedValue(undefined)
    ;(globalThis as Record<string, unknown>).mixDesktop = {
      chatSend: chatSendMock,
    }
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  async function getHook() {
    const { useApprovalHandler } = await import('../useApprovalHandler')
    return useApprovalHandler
  }

  function callHook(hook: typeof import('../useApprovalHandler').useApprovalHandler, chatApproval: ChatApprovalRequest | null) {
    hook({
      chatApproval,
      addMessage,
      setLoading,
      isStreamingRef,
      agentBufferRef,
    })
  }

  it('runs effect without adding messages when chatApproval is null', async () => {
    const hook = await getHook()
    callHook(hook, null)
    runEffects()
    expect(addMessage).not.toHaveBeenCalled()
  })

  it('runs effect without adding messages when chatApproval status is pending', async () => {
    const hook = await getHook()
    callHook(hook, makeApproval('pending'))
    runEffects()
    expect(addMessage).not.toHaveBeenCalled()
  })

  it('does not fire when prev status was not pending (e.g. initial approved)', async () => {
    const hook = await getHook()

    // First call with approved — prev was 'none', not 'pending'
    callHook(hook, makeApproval('approved'))
    runEffects()
    expect(addMessage).not.toHaveBeenCalled()
  })

  // --- New tests for uncovered branches ---

  it('pending -> approved transition adds system message and calls handleApprovalFollowUp', async () => {
    const hook = await getHook()

    // First call: set prev status to 'pending'
    callHook(hook, makeApproval('pending'))
    runEffects()

    // Verify no messages during pending phase
    expect(addMessage).not.toHaveBeenCalled()

    // Second call: transition to 'approved'
    callHook(hook, makeApproval('approved'))
    runEffects()

    // Should add a system approval message
    expect(addMessage).toHaveBeenCalledTimes(2) // system msg + user follow-up
    const systemCall = addMessage.mock.calls[0][0]
    expect(systemCall.role).toBe('system')
    expect(systemCall.content).toContain('已批准')
    expect(systemCall.content).toContain('文件删除')

    // Should set loading true
    expect(setLoading).toHaveBeenCalledWith(true)

    // Should call chatSend
    expect(chatSendMock).toHaveBeenCalledTimes(1)
    const sendArg = chatSendMock.mock.calls[0][0]
    expect(sendArg.messages).toBeDefined()
    // Last message should be the user follow-up prompt
    const lastMsg = sendArg.messages[sendArg.messages.length - 1]
    expect(lastMsg.role).toBe('user')
    expect(lastMsg.content).toContain('批准')
  })

  it('pending -> rejected transition adds rejection system message and calls handleApprovalFollowUp', async () => {
    const hook = await getHook()

    // First call: set prev status to 'pending'
    callHook(hook, makeApproval('pending'))
    runEffects()

    // Second call: transition to 'rejected'
    callHook(hook, makeApproval('rejected'))
    runEffects()

    // Should add a rejection system message
    expect(addMessage).toHaveBeenCalledTimes(2)
    const systemCall = addMessage.mock.calls[0][0]
    expect(systemCall.role).toBe('system')
    expect(systemCall.content).toContain('已拒绝')
    expect(systemCall.content).toContain('文件删除')

    // Should set loading true
    expect(setLoading).toHaveBeenCalledWith(true)

    // Should call chatSend with rejection prompt
    expect(chatSendMock).toHaveBeenCalledTimes(1)
    const sendArg = chatSendMock.mock.calls[0][0]
    const lastMsg = sendArg.messages[sendArg.messages.length - 1]
    expect(lastMsg.role).toBe('user')
    expect(lastMsg.content).toContain('拒绝')
  })

  it('handleApprovalFollowUp returns early when sessionId is empty', async () => {
    state.sessionId = ''

    const hook = await getHook()

    // Set prev to pending, then transition to approved
    callHook(hook, makeApproval('pending'))
    runEffects()

    callHook(hook, makeApproval('approved'))
    runEffects()

    // Should add the system approval message but NOT the user follow-up
    // because handleApprovalFollowUp returns early when sessionId is empty
    expect(addMessage).toHaveBeenCalledTimes(1) // only the system message from the effect
    const systemCall = addMessage.mock.calls[0][0]
    expect(systemCall.role).toBe('system')

    // chatSend should NOT have been called
    expect(chatSendMock).not.toHaveBeenCalled()
  })

  it('chatSend failure adds error message and sets loading false', async () => {
    chatSendMock.mockRejectedValue(new Error('network error'))

    const hook = await getHook()

    // Set prev to pending, then transition to approved
    callHook(hook, makeApproval('pending'))
    runEffects()

    callHook(hook, makeApproval('approved'))
    runEffects()

    // Allow the promise rejection to resolve
    await vi.runAllTimersAsync()

    // Should have 3 addMessage calls:
    // 1. system approval message (from effect)
    // 2. user follow-up message (from handleApprovalFollowUp)
    // 3. error message (from catch)
    expect(addMessage).toHaveBeenCalledTimes(3)
    const errorCall = addMessage.mock.calls[2][0]
    expect(errorCall.role).toBe('error')
    expect(errorCall.content).toContain('发送后续消息失败')

    expect(setLoading).toHaveBeenCalledWith(false)
  })

  it('includes soulPrompt as system message when present', async () => {
    state.soulPrompt = 'You are a helpful assistant.'
    state.messages = [
      { id: 'm1', role: 'user', content: 'hello', timestamp: 100 },
      { id: 'm2', role: 'agent', content: 'hi', timestamp: 200 },
    ]

    const hook = await getHook()

    callHook(hook, makeApproval('pending'))
    runEffects()

    callHook(hook, makeApproval('approved'))
    runEffects()

    expect(chatSendMock).toHaveBeenCalledTimes(1)
    const sendArg = chatSendMock.mock.calls[0][0]
    // First message should be the soul system prompt
    expect(sendArg.messages[0]).toEqual({
      role: 'system',
      content: 'You are a helpful assistant.',
    })
  })

  it('filters out system and error messages when building API messages', async () => {
    state.soulPrompt = ''
    state.messages = [
      { id: 'm1', role: 'user', content: 'hello', timestamp: 100 },
      { id: 'm2', role: 'system', content: 'sys msg', timestamp: 150 },
      { id: 'm3', role: 'error', content: 'err msg', timestamp: 175 },
      { id: 'm4', role: 'agent', content: 'hi back', timestamp: 200 },
    ]

    const hook = await getHook()

    callHook(hook, makeApproval('pending'))
    runEffects()

    callHook(hook, makeApproval('approved'))
    runEffects()

    expect(chatSendMock).toHaveBeenCalledTimes(1)
    const sendArg = chatSendMock.mock.calls[0][0]
    const roles = sendArg.messages.map((m: { role: string }) => m.role)
    // system and error messages should be filtered out
    expect(roles).not.toContain('system')
    expect(roles).not.toContain('error')
    // Should include user and assistant messages
    expect(roles).toContain('user')
    expect(roles).toContain('assistant')
  })

  it('maps agent role to assistant in API messages', async () => {
    state.soulPrompt = ''
    state.messages = [
      { id: 'm1', role: 'user', content: 'hello', timestamp: 100 },
      { id: 'm2', role: 'agent', content: 'response', timestamp: 200 },
    ]

    const hook = await getHook()

    callHook(hook, makeApproval('pending'))
    runEffects()

    callHook(hook, makeApproval('approved'))
    runEffects()

    expect(chatSendMock).toHaveBeenCalledTimes(1)
    const sendArg = chatSendMock.mock.calls[0][0]
    const apiRoles = sendArg.messages.map((m: { role: string }) => m.role)
    // 'agent' should be mapped to 'assistant'
    expect(apiRoles).toContain('assistant')
    expect(apiRoles).not.toContain('agent')
  })

  it('sets chatApproval to null via setTimeout after transition', async () => {
    const hook = await getHook()

    callHook(hook, makeApproval('pending'))
    runEffects()

    callHook(hook, makeApproval('approved'))
    runEffects()

    // Before timer fires, chatApproval should not be set to null yet
    // (setState was not called with chatApproval: null)
    // Now advance timers by 100ms
    vi.advanceTimersByTime(100)

    // useAppStore.setState should have been called with { chatApproval: null }
    const { useAppStore } = await import('../../stores/app')
    expect(useAppStore.setState).toHaveBeenCalledWith({ chatApproval: null })
  })

  it('does not call handleApprovalFollowUp when prev status is not pending', async () => {
    const hook = await getHook()

    // First call: directly set to 'rejected' without going through 'pending'
    callHook(hook, makeApproval('rejected'))
    runEffects()

    // Should not add any messages or call chatSend
    expect(addMessage).not.toHaveBeenCalled()
    expect(chatSendMock).not.toHaveBeenCalled()
  })

  it('returns handleApprovalFollowUp function', async () => {
    const hook = await getHook()
    const result = hook({
      chatApproval: null,
      addMessage,
      setLoading,
      isStreamingRef,
      agentBufferRef,
    })
    expect(result.handleApprovalFollowUp).toBeTypeOf('function')
  })

  it('handleApprovalFollowUp returns early when window.mixDesktop is not available', async () => {
    ;(globalThis as Record<string, unknown>).mixDesktop = undefined

    const hook = await getHook()

    callHook(hook, makeApproval('pending'))
    runEffects()

    callHook(hook, makeApproval('approved'))
    runEffects()

    // Should add only the system message from the effect, not the follow-up user message
    expect(addMessage).toHaveBeenCalledTimes(1)
    expect(addMessage.mock.calls[0][0].role).toBe('system')
    expect(chatSendMock).not.toHaveBeenCalled()
  })

  it('resets isStreamingRef and agentBufferRef on approval follow-up', async () => {
    isStreamingRef.current = true
    agentBufferRef.current = 'some buffer'

    const hook = await getHook()

    callHook(hook, makeApproval('pending'))
    runEffects()

    callHook(hook, makeApproval('approved'))
    runEffects()

    expect(isStreamingRef.current).toBe(true) // set to true by handleApprovalFollowUp
    expect(agentBufferRef.current).toBe('') // reset to empty
  })

  it('does not fire transition when going from null to pending', async () => {
    const hook = await getHook()

    // null -> pending: should just record the pending status
    callHook(hook, null)
    runEffects()

    callHook(hook, makeApproval('pending'))
    runEffects()

    expect(addMessage).not.toHaveBeenCalled()
    expect(chatSendMock).not.toHaveBeenCalled()
  })

  it('uses correct category label for different categories', async () => {
    const hook = await getHook()

    const shellApproval: ChatApprovalRequest = {
      id: 'approval-2',
      messageId: 'msg-2',
      content: 'sudo apt-get install something',
      category: 'shell_exec',
      summary: '执行命令',
      confidence: 'medium',
      matchedPattern: 'sudo',
      status: 'pending',
      createdAt: Date.now(),
    }

    // Set to pending first
    callHook(hook, shellApproval)
    runEffects()

    // Transition to rejected with the same approval (different category)
    const rejectedApproval = { ...shellApproval, status: 'rejected' as const }
    callHook(hook, rejectedApproval)
    runEffects()

    const systemCall = addMessage.mock.calls[0][0]
    expect(systemCall.content).toContain('命令执行')
  })
})
