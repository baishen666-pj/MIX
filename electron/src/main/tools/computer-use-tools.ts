import type { ToolSpec, ToolHandler } from './types'

export const computerScreenshotSpec: ToolSpec = Object.freeze({
  name: 'computer.screenshot',
  description: 'Capture a screenshot of the current screen. Returns base64-encoded PNG image.',
  inputSchema: {
    type: 'object',
    properties: {
      monitor: { type: 'number', description: 'Monitor index (default: 0)' }
    }
  },
  sandboxLevel: 'network'
})

export const computerClickSpec: ToolSpec = Object.freeze({
  name: 'computer.click',
  description: 'Click at the specified screen coordinates.',
  inputSchema: {
    type: 'object',
    properties: {
      x: { type: 'number', description: 'X coordinate' },
      y: { type: 'number', description: 'Y coordinate' },
      button: { type: 'string', enum: ['left', 'right'], description: 'Mouse button (default: left)' }
    },
    required: ['x', 'y']
  },
  sandboxLevel: 'network'
})

export const computerTypeSpec: ToolSpec = Object.freeze({
  name: 'computer.type',
  description: 'Type text using the keyboard.',
  inputSchema: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'Text to type' }
    },
    required: ['text']
  },
  sandboxLevel: 'network'
})

export const computerKeyPressSpec: ToolSpec = Object.freeze({
  name: 'computer.key_press',
  description: 'Press keyboard key(s). Use for shortcuts like Ctrl+C.',
  inputSchema: {
    type: 'object',
    properties: {
      keys: { type: 'array', items: { type: 'string' }, description: 'Keys to press simultaneously' }
    },
    required: ['keys']
  },
  sandboxLevel: 'network'
})

export const computerMouseSpec: ToolSpec = Object.freeze({
  name: 'computer.mouse_move',
  description: 'Move the mouse to the specified screen coordinates.',
  inputSchema: {
    type: 'object',
    properties: {
      x: { type: 'number', description: 'X coordinate' },
      y: { type: 'number', description: 'Y coordinate' }
    },
    required: ['x', 'y']
  },
  sandboxLevel: 'network'
})

export const computerScrollSpec: ToolSpec = Object.freeze({
  name: 'computer.scroll',
  description: 'Scroll at the specified position.',
  inputSchema: {
    type: 'object',
    properties: {
      x: { type: 'number', description: 'X coordinate' },
      y: { type: 'number', description: 'Y coordinate' },
      amount: { type: 'number', description: 'Scroll amount (positive: up, negative: down)' }
    }
  },
  sandboxLevel: 'network'
})

function makeHandler(method: string): ToolHandler {
  return async (args) => {
    try {
      const { sendRequest, isRunning } = await import('./../computer-use/bridge')
      if (!isRunning()) {
        return { ok: false, data: null, error: 'Computer Use bridge not running' }
      }
      const res = await sendRequest(method, args)
      if (res.error) {
        return { ok: false, data: null, error: res.error.message }
      }
      return { ok: true, data: res.result }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return { ok: false, data: null, error: msg }
    }
  }
}

export const computerScreenshotHandler: ToolHandler = makeHandler('screenshot')
export const computerClickHandler: ToolHandler = makeHandler('click')
export const computerTypeHandler: ToolHandler = makeHandler('type_text')
export const computerKeyPressHandler: ToolHandler = makeHandler('key_press')
export const computerMouseHandler: ToolHandler = makeHandler('mouse_move')
export const computerScrollHandler: ToolHandler = makeHandler('scroll')
