/**
 * Tool registration entry point.
 * Imports all tool modules and registers them with the central registry.
 */

import { registerTool } from './registry'
import { readFileSpec, readFileHandler, writeFileSpec, writeFileHandler } from './file-ops'
import { shellSpec, shellHandler } from './shell'
import { searchSpec, searchHandler } from './search'
import {
  computerScreenshotSpec, computerScreenshotHandler,
  computerClickSpec, computerClickHandler,
  computerTypeSpec, computerTypeHandler,
  computerKeyPressSpec, computerKeyPressHandler,
  computerMouseSpec, computerMouseHandler,
  computerScrollSpec, computerScrollHandler
} from './computer-use-tools'
import { imageGenSpec, imageGenHandler } from './image-gen'

/** Register all built-in tools. Idempotent — safe to call multiple times. */
export function registerBuiltinTools(): void {
  registerTool(readFileSpec, readFileHandler)
  registerTool(writeFileSpec, writeFileHandler)
  registerTool(shellSpec, shellHandler)
  registerTool(searchSpec, searchHandler)
  registerTool(computerScreenshotSpec, computerScreenshotHandler)
  registerTool(computerClickSpec, computerClickHandler)
  registerTool(computerTypeSpec, computerTypeHandler)
  registerTool(computerKeyPressSpec, computerKeyPressHandler)
  registerTool(computerMouseSpec, computerMouseHandler)
  registerTool(computerScrollSpec, computerScrollHandler)
  registerTool(imageGenSpec, imageGenHandler)
}

// Re-export for convenience
export { registerTool, unregisterTool, getTool, listToolSpecs, listToolSpecsByLevel, executeTool, clearTools, type RegisteredTool } from './registry'
export type { ToolSpec, ToolHandler, ToolContext, ToolResult, SandboxLevel } from './types'
