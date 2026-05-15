import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Note: useChatStream sets up window.mixDesktop event listeners in a useEffect.
 * Since @testing-library/react is not available and the vitest environment
 * is 'node' (no jsdom), we mock React hooks and provide a global window
 * via globalThis to test the listener registration logic.
 */

// Ensure window/globalThis.mixDesktop is available for the source module
if (typeof globalThis.window === 'undefined') {
  (globalThis as Record<string, unknown>).window = globalThis
}

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

vi.mock('../../stores/app', () => ({
  useAppStore: {
    getState: () => ({
      sessionId: 'session-1',
      messages: [],
      soulPrompt: '',
      submitChatApproval: vi.fn(),
    }),
    setState: vi.fn(),
  },
}))

vi.mock('../../lib/approvalDetection', () => ({
  detectDangerousContent: vi.fn(() => ({ detected: false, category: null, summary: '', confidence: 'medium', matchedPattern: null })),
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

function runEffects() {
  for (const effect of effectQueue) {
    effect()
  }
  effectQueue = []
}

describe('useChatStream', () => {
  const appendToLastAgent = vi.fn()
  const setLoading = vi.fn()
  const setToolProgress = vi.fn()
  const addMessage = vi.fn()
  const appendReasoning = vi.fn()
  const clearReasoning = vi.fn()
  const notify = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    refStore = {}
    effectQueue = []
    ;(globalThis as Record<string, unknown>).mixDesktop = undefined
  })

  it('returns agentBufferRef and isStreamingRef', async () => {
    const { useChatStream } = await import('../useChatStream')
    const result = useChatStream(
      appendToLastAgent, setLoading, setToolProgress, addMessage,
      appendReasoning, clearReasoning, notify,
      false, null
    )
    expect(result.agentBufferRef).toBeDefined()
    expect(result.isStreamingRef).toBeDefined()
    expect(result.agentBufferRef.current).toBe('')
    expect(result.isStreamingRef.current).toBe(false)
  })

  it('registers event listeners when window.mixDesktop is available', async () => {
    const unsub = vi.fn()
    const mockAiGui = {
      onChatChunk: vi.fn(() => unsub),
      onChatDone: vi.fn(() => unsub),
      onChatError: vi.fn(() => unsub),
      onToolProgress: vi.fn(() => unsub),
      onChatReasoning: vi.fn(() => unsub),
    }
    ;(globalThis as Record<string, unknown>).mixDesktop = mockAiGui

    const { useChatStream } = await import('../useChatStream')
    useChatStream(
      appendToLastAgent, setLoading, setToolProgress, addMessage,
      appendReasoning, clearReasoning, notify,
      false, 'session-1'
    )
    runEffects()

    expect(mockAiGui.onChatChunk).toHaveBeenCalled()
    expect(mockAiGui.onChatDone).toHaveBeenCalled()
    expect(mockAiGui.onChatError).toHaveBeenCalled()
    expect(mockAiGui.onToolProgress).toHaveBeenCalled()
    expect(mockAiGui.onChatReasoning).toHaveBeenCalled()
  })

  it('does not crash when window.mixDesktop is undefined', async () => {
    const { useChatStream } = await import('../useChatStream')
    expect(() => {
      useChatStream(
        appendToLastAgent, setLoading, setToolProgress, addMessage,
        appendReasoning, clearReasoning, notify,
        false, null
      )
      runEffects()
    }).not.toThrow()
  })
})
