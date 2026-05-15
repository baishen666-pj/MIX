import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGetActiveProvider, mockUpdateProvider, mockFromPartition } = vi.hoisted(() => ({
  mockGetActiveProvider: vi.fn(),
  mockUpdateProvider: vi.fn(),
  mockFromPartition: vi.fn(() => ({
    clearStorageData: vi.fn(() => Promise.resolve())
  }))
}))

vi.mock('electron', () => ({
  BrowserWindow: vi.fn(),
  session: {
    fromPartition: mockFromPartition
  }
}))

vi.mock('../config', () => ({
  getActiveProvider: mockGetActiveProvider,
  updateProvider: mockUpdateProvider
}))

import { getChatGPTSession, logoutChatGPT } from '../auth'

beforeEach(() => {
  mockGetActiveProvider.mockClear()
  mockUpdateProvider.mockClear()
  // Reset fromPartition to default implementation
  mockFromPartition.mockReturnValue({
    clearStorageData: vi.fn(() => Promise.resolve())
  })
})

describe('getChatGPTSession', () => {
  it('returns null when active provider is not chatgpt', async () => {
    mockGetActiveProvider.mockReturnValue({ type: 'openai', apiKey: 'key' })
    const result = await getChatGPTSession()
    expect(result).toBeNull()
  })

  it('returns apiKey when provider is chatgpt', async () => {
    mockGetActiveProvider.mockReturnValue({ type: 'chatgpt', apiKey: 'test-token-123' })
    const result = await getChatGPTSession()
    expect(result).toBe('test-token-123')
  })

  it('returns null when chatgpt provider has no apiKey', async () => {
    mockGetActiveProvider.mockReturnValue({ type: 'chatgpt', apiKey: '' })
    const result = await getChatGPTSession()
    expect(result).toBeNull()
  })
})

describe('logoutChatGPT', () => {
  it('resolves after clearing storage data', async () => {
    await expect(logoutChatGPT()).resolves.toBeUndefined()
  })

  it('resolves even when clearStorageData fails', async () => {
    mockFromPartition.mockReturnValue({
      clearStorageData: vi.fn(() => Promise.reject(new Error('Storage error')))
    })
    await expect(logoutChatGPT()).resolves.toBeUndefined()
  })
})
