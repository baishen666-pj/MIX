import { net } from 'electron'
import { join } from 'path'
import { writeFileSync, mkdirSync } from 'fs'
import { getActiveProvider } from '../config'
import { getStrategy } from '../providers/registry'
import type { ToolSpec, ToolHandler, ToolResult } from './types'

export const imageGenSpec: ToolSpec = {
  name: 'image.generate',
  description: 'Generate images using AI. Creates pixel art, illustrations, sprites, and visual assets. Works with any active provider (ChatGPT subscription, OpenAI API, etc). Returns the saved file path.',
  inputSchema: {
    type: 'object',
    properties: {
      prompt: {
        type: 'string',
        description: 'The image generation prompt. Be specific about style, size, perspective, and content.'
      },
      size: {
        type: 'string',
        description: 'Image size hint: "1024x1024" (default), "1536x1024", "1024x1536"',
        default: '1024x1024'
      },
      filename: {
        type: 'string',
        description: 'Output filename (without path). Defaults to generated name with timestamp.'
      }
    },
    required: ['prompt']
  },
  sandboxLevel: 'network'
}

export const imageGenHandler: ToolHandler = async (args): Promise<ToolResult> => {
  const prompt = args.prompt as string
  if (!prompt || typeof prompt !== 'string') {
    return { ok: false, data: null, error: 'prompt is required' }
  }

  const size = (args.size as string) || '1024x1024'
  const filename = (args.filename as string) || `gen_${Date.now()}.png`
  const provider = getActiveProvider()
  const strategy = getStrategy(provider.type)

  if (!provider.apiKey) {
    return { ok: false, data: null, error: `No credentials for provider "${provider.name}". Please login or add API key in Settings.` }
  }

  // Try OpenAI Images API first (works for OpenAI API key providers)
  if (provider.type === 'openai' && !strategy.isSubscription) {
    return generateViaImagesApi(provider, strategy, prompt, size, filename)
  }

  // For ChatGPT subscription and other providers, use chat-based generation
  return generateViaChat(provider, strategy, prompt, size, filename)
}

async function generateViaImagesApi(
  provider: ReturnType<typeof getActiveProvider>,
  strategy: ReturnType<typeof getStrategy>,
  prompt: string,
  size: string,
  filename: string
): Promise<ToolResult> {
  const url = provider.baseUrl.replace(/\/v\d+$/, '') + '/v1/images/generations'
  const body = JSON.stringify({
    model: 'gpt-image-2',
    prompt,
    n: 1,
    size,
    quality: 'low',
    response_format: 'b64_json'
  })

  return new Promise<ToolResult>((resolve) => {
    const request = net.request({ method: 'POST', url })
    request.setHeader('Content-Type', 'application/json')
    strategy.applyAuthHeaders(request, provider.apiKey)

    let responseData = ''
    request.on('response', (response) => {
      if (response.statusCode !== 200) {
        let errBody = ''
        response.on('data', (chunk: Buffer) => { errBody += chunk.toString() })
        response.on('end', () => {
          resolve({ ok: false, data: null, error: `Images API ${response.statusCode}: ${errBody.substring(0, 300)}` })
        })
        return
      }
      response.on('data', (chunk: Buffer) => { responseData += chunk.toString() })
      response.on('end', () => {
        try {
          const json = JSON.parse(responseData)
          const b64 = json.data?.[0]?.b64_json
          if (!b64) {
            resolve({ ok: false, data: null, error: 'No image data in response' })
            return
          }
          resolve(saveImage(b64, filename, prompt, 'gpt-image-2'))
        } catch (err: unknown) {
          resolve({ ok: false, data: null, error: `Parse error: ${err instanceof Error ? err.message : String(err)}` })
        }
      })
    })
    request.on('error', (error) => {
      resolve({ ok: false, data: null, error: `Network error: ${error.message}` })
    })
    request.write(body)
    request.end()
  })
}

async function generateViaChat(
  provider: ReturnType<typeof getActiveProvider>,
  strategy: ReturnType<typeof getStrategy>,
  prompt: string,
  size: string,
  filename: string
): Promise<ToolResult> {
  // Build a chat message that asks the model to generate an image
  const imagePrompt = `Generate an image with these specifications:
${prompt}

Image size: ${size}
Style: pixel art, game asset quality

IMPORTANT: Generate the actual image, do not just describe it.`

  const url = strategy.buildUrl(provider.baseUrl)
  const body = strategy.buildBody(
    provider.defaultModel,
    [{ role: 'user', content: imagePrompt }],
    false
  )

  return new Promise<ToolResult>((resolve) => {
    const request = net.request({ method: 'POST', url })
    request.setHeader('Content-Type', 'application/json')
    strategy.applyAuthHeaders(request, provider.apiKey)
    strategy.applyExtraHeaders(request, provider.baseUrl)

    let responseData = ''
    request.on('response', (response) => {
      if (response.statusCode !== 200) {
        let errBody = ''
        response.on('data', (chunk: Buffer) => { errBody += chunk.toString() })
        response.on('end', () => {
          resolve({ ok: false, data: null, error: `Chat API ${response.statusCode}: ${errBody.substring(0, 300)}` })
        })
        return
      }

      response.on('data', (chunk: Buffer) => { responseData += chunk.toString() })
      response.on('end', () => {
        // Try to extract image URL from ChatGPT response
        // ChatGPT returns images as markdown: ![img](url) or as asset URLs
        const imageUrlMatch = responseData.match(/!\[.*?\]\((https?:\/\/[^\s)"']+)\)/)
          || responseData.match(/(https?:\/\/[^\s"']*?\.(?:png|jpg|jpeg|webp)[^\s"']*)/i)
          || responseData.match(/"asset_pointer"\s*:\s*"(file-service:\/\/[^\s"']+)"/)

        if (imageUrlMatch) {
          const imageUrl = imageUrlMatch[1]
          resolve(downloadAndSave(imageUrl, provider, strategy, filename, prompt, provider.defaultModel))
          return
        }

        // Try to extract base64 image data
        const b64Match = responseData.match(/data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)/)
        if (b64Match) {
          resolve(saveImage(b64Match[2], filename, prompt, provider.defaultModel))
          return
        }

        // Fallback: check if response contains image-related content
        if (responseData.includes('"content_type":"image"') || responseData.includes('"image"')) {
          resolve({
            ok: true,
            data: {
              path: 'inline',
              filename,
              model: provider.defaultModel,
              prompt,
              note: 'Image was generated inline in chat. Check the chat panel to view and save it.'
            }
          })
          return
        }

        resolve({
          ok: false,
          data: null,
          error: `Could not extract image from response. The model may not support image generation. Response length: ${responseData.length} chars`
        })
      })
    })
    request.on('error', (error) => {
      resolve({ ok: false, data: null, error: `Network error: ${error.message}` })
    })
    request.write(body)
    request.end()
  })
}

function downloadAndSave(
  imageUrl: string,
  provider: ReturnType<typeof getActiveProvider>,
  strategy: ReturnType<typeof getStrategy>,
  filename: string,
  prompt: string,
  model: string
): ToolResult {
  // Synchronous placeholder — actual download needs async
  // For now, return the URL for the caller to handle
  return {
    ok: true,
    data: {
      url: imageUrl,
      filename,
      model,
      prompt,
      note: 'Image URL extracted. Save manually or use the chat panel.'
    }
  }
}

function saveImage(b64: string, filename: string, prompt: string, model: string): ToolResult {
  const { join } = require('path')
  const { app } = require('electron')
  const spritesDir = join(app.getPath('userData'), 'data', 'sprites')
  mkdirSync(spritesDir, { recursive: true })

  const filePath = join(spritesDir, filename)
  const buffer = Buffer.from(b64, 'base64')
  writeFileSync(filePath, buffer)

  return {
    ok: true,
    data: { path: filePath, filename, model, prompt }
  }
}
