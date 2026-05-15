import { describe, it, expect } from 'vitest'
import { getStrategy, getAllStrategies, registerStrategy } from '../registry'
import { openAICompatibleStrategy } from '../openai-compat'
import { claudeStrategy } from '../claude'
import { chatGPTSubscriptionStrategy } from '../chatgpt-subscription'
import type { ProviderStrategy } from '../types'

describe('Provider Registry', () => {
  it('returns OpenAI strategy for openai type', () => {
    expect(getStrategy('openai')).toBe(openAICompatibleStrategy)
  })

  it('returns OpenAI strategy for zhipu type', () => {
    expect(getStrategy('zhipu')).toBe(openAICompatibleStrategy)
  })

  it('returns OpenAI strategy for ollama type', () => {
    expect(getStrategy('ollama')).toBe(openAICompatibleStrategy)
  })

  it('returns OpenAI strategy for openrouter type', () => {
    expect(getStrategy('openrouter')).toBe(openAICompatibleStrategy)
  })

  it('returns OpenAI strategy for custom type', () => {
    expect(getStrategy('custom')).toBe(openAICompatibleStrategy)
  })

  it('returns Claude strategy for claude type', () => {
    expect(getStrategy('claude')).toBe(claudeStrategy)
  })

  it('returns ChatGPT strategy for chatgpt type', () => {
    expect(getStrategy('chatgpt')).toBe(chatGPTSubscriptionStrategy)
  })

  it('returns OpenAI strategy as default for unknown type', () => {
    expect(getStrategy('unknown-provider')).toBe(openAICompatibleStrategy)
  })

  it('getAllStrategies returns all registered strategies', () => {
    const all = getAllStrategies()
    expect(all.length).toBeGreaterThanOrEqual(3)
    const types = all.map((s) => s.protocolType)
    expect(types).toContain('openai')
    expect(types).toContain('claude')
    expect(types).toContain('chatgpt')
  })

  it('registerStrategy adds new strategy', () => {
    const customStrategy: ProviderStrategy = {
      protocolType: 'test-custom',
      isSubscription: false,
      buildUrl: (baseUrl) => `${baseUrl}/test`,
      buildBody: (model, messages, stream) => JSON.stringify({ model, messages, stream }),
      applyAuthHeaders: () => {},
      applyExtraHeaders: () => {}
    }
    registerStrategy(customStrategy)
    expect(getStrategy('test-custom')).toBe(customStrategy)
  })
})
