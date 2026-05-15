/**
 * Central tool registry — supports dynamic registration at runtime.
 * Each tool is a pair of (ToolSpec, ToolHandler) identified by name.
 */

import type { ToolSpec, ToolHandler, ToolContext, ToolResult, SandboxLevel } from './types'

export interface RegisteredTool {
  readonly spec: ToolSpec
  readonly handler: ToolHandler
}

const tools = new Map<string, RegisteredTool>()

/** Register a tool. Overwrites any existing tool with the same name. */
export function registerTool(spec: ToolSpec, handler: ToolHandler): void {
  tools.set(spec.name, Object.freeze({ spec, handler }))
}

/** Remove a tool by name. Returns true if the tool existed. */
export function unregisterTool(name: string): boolean {
  return tools.delete(name)
}

/** Look up a registered tool by name. */
export function getTool(name: string): RegisteredTool | undefined {
  return tools.get(name)
}

/** List all registered tool specs. */
export function listToolSpecs(): ToolSpec[] {
  return Array.from(tools.values()).map((t) => t.spec)
}

/** List specs filtered by minimum sandbox level. */
export function listToolSpecsByLevel(level: SandboxLevel): ToolSpec[] {
  const order: readonly SandboxLevel[] = ['readonly', 'write', 'shell', 'network']
  const idx = order.indexOf(level)
  return listToolSpecs().filter((s) => order.indexOf(s.sandboxLevel) <= idx)
}

/** Execute a registered tool by name. Throws if the tool is not found. */
export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolResult> {
  const entry = tools.get(name)
  if (!entry) {
    return { ok: false, data: null, error: `Tool not found: ${name}` }
  }
  try {
    const result = await entry.handler(args, ctx)
    return result
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, data: null, error: message }
  }
}

/** Remove all registered tools (useful for tests). */
export function clearTools(): void {
  tools.clear()
}
