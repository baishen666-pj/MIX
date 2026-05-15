import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Note: useExportChat uses React's useState and useCallback.
 * Since @testing-library/react is not available and the vitest environment
 * is 'node' (no jsdom), we mock React hooks and use globalThis for window.
 */

// Ensure window is available for source module references
if (typeof globalThis.window === 'undefined') {
  (globalThis as Record<string, unknown>).window = globalThis
}

let stateStore: Record<string, unknown> = {}
let setters: Record<string, (val: unknown) => void> = {}

vi.mock('react', () => ({
  useState: <T>(initial: T): [T, (val: T | ((prev: T) => T)) => void] => {
    const key = `state_${initial}`
    stateStore[key] = initial
    const setter = (val: T | ((prev: T) => T)) => {
      stateStore[key] = typeof val === 'function' ? (val as (prev: T) => T)(stateStore[key] as T) : val
    }
    setters[key] = setter as (val: unknown) => void
    return [stateStore[key] as T, setter]
  },
  useCallback: <T extends (...args: unknown[]) => unknown>(fn: T) => {
    return fn
  },
}))

vi.mock('../../lib/export', () => ({
  getExportContent: vi.fn(() => '# Exported Content\nSome text'),
  getExportFileName: vi.fn((_title: string, format: string) => `export.${format === 'markdown' ? 'md' : format}`),
}))

describe('useExportChat', () => {
  const notify = vi.fn()
  const messages = [
    { id: '1', role: 'user' as const, content: 'Hello', timestamp: 1000 },
    { id: '2', role: 'agent' as const, content: 'Hi!', timestamp: 2000 },
  ]

  beforeEach(async () => {
    vi.clearAllMocks()
    stateStore = {}
    setters = {}
    ;(globalThis as Record<string, unknown>).mixDesktop = undefined
  })

  it('returns initial state with exportOpen=false and markdown format', async () => {
    const { useExportChat } = await import('../useExportChat')
    const result = useExportChat({ messages, sessionId: 'sess-1', notify })
    expect(result.exportOpen).toBe(false)
    expect(result.exportFormat).toBe('markdown')
  })

  it('returns setter functions', async () => {
    const { useExportChat } = await import('../useExportChat')
    const result = useExportChat({ messages, sessionId: 'sess-1', notify })
    expect(result.setExportOpen).toBeTypeOf('function')
    expect(result.setExportFormat).toBeTypeOf('function')
    expect(result.handleExport).toBeTypeOf('function')
  })

  it('handleExport calls getExportContent and getExportFileName via mixDesktop path', async () => {
    const saveExport = vi.fn().mockResolvedValue(true)
    ;(globalThis as Record<string, unknown>).mixDesktop = { saveExport }

    const exportMod = await import('../../lib/export')
    const { useExportChat } = await import('../useExportChat')
    const result = useExportChat({ messages, sessionId: 'sess-1', notify })

    await result.handleExport()

    expect(exportMod.getExportContent).toHaveBeenCalledWith(
      messages,
      expect.stringContaining('对话'),
      'markdown'
    )
    expect(exportMod.getExportFileName).toHaveBeenCalled()
    expect(saveExport).toHaveBeenCalledWith({
      content: expect.any(String),
      fileName: expect.any(String),
    })
  })

  it('handleExport uses mixDesktop.saveExport when available', async () => {
    const saveExport = vi.fn().mockResolvedValue(true)
    ;(globalThis as Record<string, unknown>).mixDesktop = { saveExport }

    const { useExportChat } = await import('../useExportChat')
    const result = useExportChat({ messages, sessionId: 'sess-1', notify })

    await result.handleExport()

    expect(saveExport).toHaveBeenCalled()
    expect(notify).toHaveBeenCalledWith('导出成功', expect.any(String))
  })
})
