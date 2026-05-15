import type { ProviderStrategy } from './types'
import { openAICompatibleStrategy } from './openai-compat'
import { claudeStrategy } from './claude'
import { chatGPTSubscriptionStrategy } from './chatgpt-subscription'

const strategies = new Map<string, ProviderStrategy>()

export function registerStrategy(strategy: ProviderStrategy): void {
  strategies.set(strategy.protocolType, strategy)
}

export function getStrategy(protocolType: string): ProviderStrategy {
  const strategy = strategies.get(protocolType)
  if (!strategy) {
    // Default to OpenAI-compatible for unknown types
    return openAICompatibleStrategy
  }
  return strategy
}

export function getAllStrategies(): ProviderStrategy[] {
  return Array.from(strategies.values())
}

// Register built-in strategies
registerStrategy(openAICompatibleStrategy)
registerStrategy(claudeStrategy)
registerStrategy(chatGPTSubscriptionStrategy)

// Aliases — these providers use OpenAI-compatible protocol
strategies.set('zhipu', openAICompatibleStrategy)
strategies.set('ollama', openAICompatibleStrategy)
strategies.set('openrouter', openAICompatibleStrategy)
strategies.set('custom', openAICompatibleStrategy)
strategies.set('hermes', openAICompatibleStrategy)
