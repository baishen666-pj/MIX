import { net } from 'electron'
import type { ProviderConfig } from '../shared/types'
import { getStrategy } from './providers/registry'

export interface DiscoveredModel {
  id: string
  name?: string
  owned_by?: string
}

export async function discoverModels(provider: ProviderConfig): Promise<DiscoveredModel[]> {
  const strategy = getStrategy(provider.type)
  const baseUrl = provider.baseUrl.replace(/\/$/, '')
  const url = `${baseUrl}/models`

  return new Promise((resolve) => {
    const controller = new AbortController()
    const timeout = setTimeout(() => {
      controller.abort()
      resolve([])
    }, 10000)

    const request = net.request({ method: 'GET', url })
    strategy.applyAuthHeaders(request, provider.apiKey)

    let body = ''

    request.on('response', (response) => {
      if (response.statusCode !== 200) {
        clearTimeout(timeout)
        response.on('data', () => {})
        resolve([])
        return
      }

      response.on('data', (chunk: Buffer) => {
        body += chunk.toString('utf-8')
      })

      response.on('end', () => {
        clearTimeout(timeout)
        try {
          const parsed = JSON.parse(body)
          // OpenAI-compatible format: { data: [{ id, object, owned_by }] }
          const data = parsed.data
          if (Array.isArray(data)) {
            const models: DiscoveredModel[] = data
              .filter((m: Record<string, unknown>) => typeof m.id === 'string')
              .map((m: Record<string, unknown>) => ({
                id: m.id as string,
                name: typeof m.name === 'string' ? m.name : undefined,
                owned_by: typeof m.owned_by === 'string' ? m.owned_by : undefined
              }))
              .sort((a: DiscoveredModel, b: DiscoveredModel) => a.id.localeCompare(b.id))
            resolve(models)
            return
          }
          // Claude format: { data: [{ id, display_name, ... }] }
          if (Array.isArray(parsed.models)) {
            const models: DiscoveredModel[] = parsed.models
              .filter((m: Record<string, unknown>) => typeof m.id === 'string')
              .map((m: Record<string, unknown>) => ({
                id: m.id as string,
                name: typeof m.display_name === 'string' ? m.display_name : undefined,
                owned_by: typeof m.created_by === 'string' ? m.created_by : undefined
              }))
              .sort((a: DiscoveredModel, b: DiscoveredModel) => a.id.localeCompare(b.id))
            resolve(models)
            return
          }
          resolve([])
        } catch {
          resolve([])
        }
      })

      response.on('error', () => {
        clearTimeout(timeout)
        resolve([])
      })
    })

    request.on('error', () => {
      clearTimeout(timeout)
      resolve([])
    })

    controller.signal.addEventListener('abort', () => request.abort())
    request.end()
  })
}
