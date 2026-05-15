/**
 * Tool specification and handler type definitions.
 * Inspired by Codex's tool architecture: spec/schema separated from execution logic.
 */

/** Permission level required to run a tool. */
export type SandboxLevel = 'readonly' | 'write' | 'shell' | 'network'

/** JSON Schema describing a tool's input parameters. */
export interface ToolSpec {
  /** Unique dot-separated name, e.g. "workspace.readFile". */
  readonly name: string
  /** Human-readable description shown to agents and users. */
  readonly description: string
  /** JSON Schema for the tool's input parameters. */
  readonly inputSchema: Record<string, unknown>
  /** Minimum permission level required. */
  readonly sandboxLevel: SandboxLevel
}

/** Contextual information available to tool handlers at execution time. */
export interface ToolContext {
  /** Absolute path to the active project/workspace root. */
  readonly workspaceRoot: string
  /** The session id that triggered this tool call, if any. */
  readonly sessionId?: string
  /** Abort signal for cancellation. */
  readonly signal?: AbortSignal
}

/** Result returned by a tool handler. */
export interface ToolResult {
  /** Whether execution succeeded. */
  readonly ok: boolean
  /** The output value — string content for text tools, structured data otherwise. */
  readonly data: unknown
  /** Human-readable error message when ok is false. */
  readonly error?: string
}

/** A tool handler implements the actual execution logic. */
export type ToolHandler = (args: Record<string, unknown>, ctx: ToolContext) => Promise<ToolResult> | ToolResult
