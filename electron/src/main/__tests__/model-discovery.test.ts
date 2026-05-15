import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ProviderConfig } from '../../shared/types'

// Mock electron net module
const mockRequest = {
  setHeader: vi.fn(),
  end: vi.fn(),
  on: vi.fn(),
  abort: vi.fn()
}

vi.mock('electron', () => ({
  net: {
    request: vi.fn(() => mockRequest)
  }
}))

// Import after mock
const { discoverModels } = await import('../model-discovery')

describe('model-discovery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const baseProvider: ProviderConfig = {
    id: 'test-provider',
    name: 'Test',
    type: 'openai',
    baseUrl: 'https://api.test.com/v1',
    apiKey: 'test-key',
    models: [],
    defaultModel: ''
  }

  it('discovers models from OpenAI-compatible API', async () => {
    const response = {
      data: [
        { id: 'gpt-4o', object: 'model', owned_by: 'openai' },
        { id: 'gpt-4o-mini', object: 'model', owned_by: 'openai' }
      ]
    }

    let responseHandler: Function = () => {}
    mockRequest.on.mockImplementation((event: string, handler: Function) => {
      if (event === 'response') responseHandler = handler
    })

    const promise = discoverModels(baseProvider)

    // Simulate response
    responseHandler({
      statusCode: 200,
      on: (event: string, handler: Function) => {
        if (event === 'data') handler(Buffer.from(JSON.stringify(response)))
        if (event === 'end') handler()
      }
    })

    const models = await promise
    expect(models).toHaveLength(2)
    expect(models[0].id).toBe('gpt-4o')
    expect(models[1].id).toBe('gpt-4o-mini')
  })

  it('returns empty array on non-200 response', async () => {
    let responseHandler: Function = () => {}
    mockRequest.on.mockImplementation((event: string, handler: Function) => {
      if (event === 'response') responseHandler = handler
    })

    const promise = discoverModels(baseProvider)

    responseHandler({
      statusCode: 401,
      on: (event: string, handler: Function) => {
        if (event === 'data') handler(Buffer.from('unauthorized'))
        if (event === 'end') handler()
      }
    })

    const models = await promise
    expect(models).toEqual([])
  })

  it('returns empty array on request error', async () => {
    let errorHandler: Function = () => {}
    mockRequest.on.mockImplementation((event: string, handler: Function) => {
      if (event === 'error') errorHandler = handler
    })

    const promise = discoverModels(baseProvider)

    errorHandler(new Error('Network error'))

    const models = await promise
    expect(models).toEqual([])
  })

  it('returns empty array on invalid JSON', async () => {
    let responseHandler: Function = () => {}
    mockRequest.on.mockImplementation((event: string, handler: Function) => {
      if (event === 'response') responseHandler = handler
    })

    const promise = discoverModels(baseProvider)

    responseHandler({
      statusCode: 200,
      on: (event: string, handler: Function) => {
        if (event === 'data') handler(Buffer.from('not json'))
        if (event === 'end') handler()
      }
    })

    const models = await promise
    expect(models).toEqual([])
  })
})
