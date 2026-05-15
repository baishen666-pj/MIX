export interface ComputerUseAction {
  method: string
  params: Record<string, unknown>
}

export interface ComputerUseResult {
  ok: boolean
  data?: unknown
  error?: string
}

export type SafetyMode = 'confirm' | 'autonomous'

export interface ComputerUseStatus {
  running: boolean
  safetyMode: SafetyMode
  actionCount: number
  screenSize?: { width: number; height: number }
}

export interface JsonRpcRequest {
  id: number
  method: string
  params: Record<string, unknown>
}

export interface JsonRpcResponse {
  id: number
  result?: unknown
  error?: { code: number; message: string }
}
