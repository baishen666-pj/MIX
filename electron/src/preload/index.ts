import { contextBridge, ipcRenderer } from 'electron'
import type { AppLocale } from '../shared/i18n/types'
import type { ChatGPTSession, ConnectionConfig, ModelConfig, ProviderConfig, ScheduleTask, Workflow } from '../shared/types'

const api = {
  getLocale: (): Promise<AppLocale> => ipcRenderer.invoke('get-locale'),
  setLocale: (locale: AppLocale): Promise<AppLocale> =>
    ipcRenderer.invoke('set-locale', locale),

  getConnectionConfig: (): Promise<ConnectionConfig> =>
    ipcRenderer.invoke('get-connection-config'),
  setConnectionConfig: (config: Partial<ConnectionConfig>): Promise<boolean> =>
    ipcRenderer.invoke('set-connection-config', config),
  getModelConfig: (profile?: string): Promise<ModelConfig> =>
    ipcRenderer.invoke('get-model-config', profile),

  getActiveProvider: (): Promise<ProviderConfig> =>
    ipcRenderer.invoke('get-active-provider'),
  setActiveProvider: (id: string): Promise<void> =>
    ipcRenderer.invoke('set-active-provider', id),
  updateProvider: (provider: ProviderConfig): Promise<void> =>
    ipcRenderer.invoke('update-provider', provider),
  removeProvider: (id: string): Promise<void> =>
    ipcRenderer.invoke('remove-provider', id),
  discoverModels: (providerId: string): Promise<Array<{ id: string; name?: string; owned_by?: string }>> =>
    ipcRenderer.invoke('discover-models', providerId),
  setProviderModel: (providerId: string, model: string): Promise<void> =>
    ipcRenderer.invoke('set-provider-model', providerId, model),

  chatgptLogin: (): Promise<ChatGPTSession> =>
    ipcRenderer.invoke('chatgpt-login'),
  chatgptLogout: (): Promise<void> =>
    ipcRenderer.invoke('chatgpt-logout'),
  subscriptionLogin: (providerId: string): Promise<{ accessToken: string }> =>
    ipcRenderer.invoke('subscription-login', providerId),

  openExternal: (url: string): Promise<void> =>
    ipcRenderer.invoke('open-external', url),

  chatSend: (opts: {
    messages: { role: string; content: string }[]
    model?: string
    profile?: string
  }): Promise<void> => ipcRenderer.invoke('chat-send', opts),

  chatAbort: (): Promise<void> => ipcRenderer.invoke('chat-abort'),

  onChatChunk: (cb: (chunk: string) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, chunk: string): void => cb(chunk)
    ipcRenderer.on('chat-chunk', handler)
    return () => ipcRenderer.removeListener('chat-chunk', handler)
  },
  onChatDone: (cb: () => void) => {
    const handler = (): void => cb()
    ipcRenderer.on('chat-done', handler)
    return () => ipcRenderer.removeListener('chat-done', handler)
  },
  onChatError: (cb: (msg: string) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, msg: string): void => cb(msg)
    ipcRenderer.on('chat-error', handler)
    return () => ipcRenderer.removeListener('chat-error', handler)
  },
  onToolProgress: (cb: (tool: string) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, tool: string): void => cb(tool)
    ipcRenderer.on('chat-tool-progress', handler)
    return () => ipcRenderer.removeListener('chat-tool-progress', handler)
  },
  onChatReasoning: (cb: (text: string) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, text: string): void => cb(text)
    ipcRenderer.on('chat-reasoning', handler)
    return () => ipcRenderer.removeListener('chat-reasoning', handler)
  },
  onChatUsage: (cb: (usage: { promptTokens: number; completionTokens: number; totalTokens: number }) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, usage: { promptTokens: number; completionTokens: number; totalTokens: number }): void => cb(usage)
    ipcRenderer.on('chat-usage', handler)
    return () => ipcRenderer.removeListener('chat-usage', handler)
  },
  onToolCallStart: (cb: (call: { id: string; name: string }) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, call: { id: string; name: string }): void => cb(call)
    ipcRenderer.on('chat-tool-call-start', handler)
    return () => ipcRenderer.removeListener('chat-tool-call-start', handler)
  },
  onToolCallResult: (cb: (result: { id: string; name: string; ok: boolean; data: unknown }) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, result: { id: string; name: string; ok: boolean; data: unknown }): void => cb(result)
    ipcRenderer.on('chat-tool-call-result', handler)
    return () => ipcRenderer.removeListener('chat-tool-call-result', handler)
  },
  listTools: () => ipcRenderer.invoke('list-tools'),

  // Sessions
  sessionsList: (limit?: number) => ipcRenderer.invoke('sessions-list', limit),
  sessionsGetMessages: (sessionId: string) => ipcRenderer.invoke('sessions-get-messages', sessionId),
  sessionsCreate: (id: string, model?: string) => ipcRenderer.invoke('sessions-create', id, model),
  sessionsEnd: (id: string) => ipcRenderer.invoke('sessions-end', id),
  sessionsUpdateTitle: (id: string, title: string) => ipcRenderer.invoke('sessions-update-title', id, title),
  sessionsDelete: (id: string) => ipcRenderer.invoke('sessions-delete', id),
  sessionsInsertMessage: (msg: { id: string; session_id: string; role: string; content: string; timestamp: number }) =>
    ipcRenderer.invoke('sessions-insert-message', msg),
  sessionsSearch: (query: string, limit?: number) => ipcRenderer.invoke('sessions-search', query, limit),

  // Notifications
  sendNotification: (opts: { title: string; body: string; silent?: boolean }) =>
    ipcRenderer.invoke('send-notification', opts),

  // Export
  saveExport: (opts: { content: string; fileName: string }) =>
    ipcRenderer.invoke('save-export', opts),

  // Persistence — Tasks
  persistenceGetTasks: () => ipcRenderer.invoke('persistence-get-tasks'),
  persistenceUpsertTask: (task: ScheduleTask) => ipcRenderer.invoke('persistence-upsert-task', task),
  persistenceDeleteTask: (id: string) => ipcRenderer.invoke('persistence-delete-task', id),

  // Persistence — Workflows
  persistenceGetWorkflows: () => ipcRenderer.invoke('persistence-get-workflows'),
  persistenceUpsertWorkflow: (wf: Workflow) => ipcRenderer.invoke('persistence-upsert-workflow', wf),
  persistenceDeleteWorkflow: (id: string) => ipcRenderer.invoke('persistence-delete-workflow', id),

  // Shell execution (for code block run)
  runShell: (command: string): Promise<string> => ipcRenderer.invoke('run-shell', command),

  // Checkpoint
  checkpointCreate: (sessionId: string, description: string) =>
    ipcRenderer.invoke('checkpoint-create', sessionId, description),
  checkpointList: (sessionId?: string) =>
    ipcRenderer.invoke('checkpoint-list', sessionId),
  checkpointRestore: (checkpointId: string) =>
    ipcRenderer.invoke('checkpoint-restore', checkpointId),
  checkpointDelete: (checkpointId: string, sessionId: string) =>
    ipcRenderer.invoke('checkpoint-delete', checkpointId, sessionId),

  // Sandbox
  sandboxGetLevel: (): Promise<string> =>
    ipcRenderer.invoke('sandbox-get-level'),
  sandboxSetLevel: (level: string): Promise<void> =>
    ipcRenderer.invoke('sandbox-set-level', level),
  sandboxCheckPermission: (operation: string): Promise<{ allowed: boolean; reason: string | null }> =>
    ipcRenderer.invoke('sandbox-check-permission', operation),
  sandboxValidateCommand: (command: string): Promise<{ allowed: boolean; reason: string | null }> =>
    ipcRenderer.invoke('sandbox-validate-command', command),

  // Memory System — MEMORY.md / USER.md / SOUL.md
  memoryRead: (profile?: string): Promise<string> => ipcRenderer.invoke('memory-read', profile),
  memoryReadEntries: (profile?: string) => ipcRenderer.invoke('memory-read-entries', profile),
  memoryAddEntry: (entry: { content: string; type: string; timestamp: number }, profile?: string) =>
    ipcRenderer.invoke('memory-add-entry', entry, profile),
  memoryUpdateEntry: (id: string, content: string, profile?: string) =>
    ipcRenderer.invoke('memory-update-entry', id, content, profile),
  memoryRemoveEntry: (id: string, profile?: string) =>
    ipcRenderer.invoke('memory-remove-entry', id, profile),
  memoryReadUserProfile: (profile?: string): Promise<string> =>
    ipcRenderer.invoke('memory-read-user-profile', profile),
  memoryWriteUserProfile: (content: string, profile?: string): Promise<boolean> =>
    ipcRenderer.invoke('memory-write-user-profile', content, profile),
  memoryReadSoul: (profile?: string): Promise<string> =>
    ipcRenderer.invoke('memory-read-soul', profile),
  memoryWriteSoul: (content: string, profile?: string): Promise<boolean> =>
    ipcRenderer.invoke('memory-write-soul', content, profile),
  memoryResetSoul: (profile?: string): Promise<boolean> =>
    ipcRenderer.invoke('memory-reset-soul', profile),

  // Agents Config — AGENTS.md / AGENTS.override.md
  agentsConfigResolve: (workDir: string): Promise<{ config: string; files: string[]; hasOverride: boolean }> =>
    ipcRenderer.invoke('agents-config-resolve', workDir),

  // MCP — Model Context Protocol
  mcpGetStatus: (): Promise<{ running: boolean }> =>
    ipcRenderer.invoke('mcp-get-status'),
  mcpConnectServer: (config: {
    id: string
    name: string
    transport: 'stdio' | 'sse'
    command?: string
    args?: string[]
    env?: Record<string, string>
    url?: string
    enabled: boolean
  }) => ipcRenderer.invoke('mcp-connect-server', config),
  mcpDisconnectServer: (serverId: string): Promise<boolean> =>
    ipcRenderer.invoke('mcp-disconnect-server', serverId),
  mcpListConnected: (): Promise<Array<{
    id: string
    name: string
    tools: Array<{ serverId: string; name: string; description?: string; inputSchema?: Record<string, unknown> }>
  }>> => ipcRenderer.invoke('mcp-list-connected'),
  mcpCallTool: (serverId: string, toolName: string, args: Record<string, unknown>) =>
    ipcRenderer.invoke('mcp-call-tool', serverId, toolName, args),

  // Computer Use
  cuStart: (): Promise<boolean> => ipcRenderer.invoke('cu-start'),
  cuStop: (): Promise<boolean> => ipcRenderer.invoke('cu-stop'),
  cuStatus: (): Promise<{ running: boolean; safetyMode: string; actionCount: number; screenSize?: { width: number; height: number } }> =>
    ipcRenderer.invoke('cu-status'),
  cuAction: (action: { method: string; params: Record<string, unknown> }): Promise<{ ok: boolean; data?: unknown; error?: string }> =>
    ipcRenderer.invoke('cu-action', action),
  cuScreenshot: (): Promise<{ ok: boolean; data?: unknown; error?: string }> =>
    ipcRenderer.invoke('cu-screenshot'),
  cuSetSafety: (mode: string): Promise<boolean> =>
    ipcRenderer.invoke('cu-set-safety', mode),
  onCuConfirmRequest: (cb: (action: { method: string; params: Record<string, unknown> }) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, action: { method: string; params: Record<string, unknown> }): void => cb(action)
    ipcRenderer.on('cu-confirm-request', handler)
    return () => ipcRenderer.removeListener('cu-confirm-request', handler)
  },
  onCuEmergencyStop: (cb: () => void) => {
    const handler = (): void => cb()
    ipcRenderer.on('cu-emergency-stop', handler)
    return () => ipcRenderer.removeListener('cu-emergency-stop', handler)
  },
  cuConfirmRespond: (approved: boolean): void => {
    ipcRenderer.send('cu-confirm-response', approved)
  },

  // Auto Updater
  updaterCheck: (): Promise<unknown> => ipcRenderer.invoke('updater-check'),
  updaterDownload: (): Promise<boolean> => ipcRenderer.invoke('updater-download'),
  updaterInstall: (): Promise<boolean> => ipcRenderer.invoke('updater-install'),
  updaterStatus: (): Promise<unknown> => ipcRenderer.invoke('updater-status'),
  onUpdaterAvailable: (cb: (info: { version: string }) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, info: { version: string }): void => cb(info)
    ipcRenderer.on('updater-available', handler)
    return () => ipcRenderer.removeListener('updater-available', handler)
  },
  onUpdaterProgress: (cb: (info: { percent: number }) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, info: { percent: number }): void => cb(info)
    ipcRenderer.on('updater-progress', handler)
    return () => ipcRenderer.removeListener('updater-progress', handler)
  },
  onUpdaterDownloaded: (cb: (info: { version: string }) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, info: { version: string }): void => cb(info)
    ipcRenderer.on('updater-downloaded', handler)
    return () => ipcRenderer.removeListener('updater-downloaded', handler)
  },
  onUpdaterError: (cb: (info: { message: string }) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, info: { message: string }): void => cb(info)
    ipcRenderer.on('updater-error', handler)
    return () => ipcRenderer.removeListener('updater-error', handler)
  },

  // IM Bridge
  imStart: (config: Record<string, unknown>): Promise<boolean> => ipcRenderer.invoke('im-start', config),
  imStop: (platform: string): Promise<boolean> => ipcRenderer.invoke('im-stop', platform),
  imStatus: (): Promise<Array<{ platform: string; running: boolean }>> => ipcRenderer.invoke('im-status'),
  imSend: (platform: string, chatId: string, text: string): Promise<boolean> =>
    ipcRenderer.invoke('im-send', platform, chatId, text),
  onImMessage: (cb: (msg: Record<string, unknown>) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, msg: Record<string, unknown>): void => cb(msg)
    ipcRenderer.on('im-message', handler)
    return () => ipcRenderer.removeListener('im-message', handler)
  },
  onImStatus: (cb: (statuses: Array<{ platform: string; running: boolean }>) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, statuses: Array<{ platform: string; running: boolean }>): void => cb(statuses)
    ipcRenderer.on('im-status', handler)
    return () => ipcRenderer.removeListener('im-status', handler)
  },

  // Hermes Gateway
  hermesHealthCheck: (): Promise<{ ok: boolean; platform: string }> =>
    ipcRenderer.invoke('hermes-health-check'),
  hermesReadApiKey: (): Promise<{ configured: boolean; key: string }> =>
    ipcRenderer.invoke('hermes-read-api-key'),
  hermesStartGateway: (): Promise<boolean> =>
    ipcRenderer.invoke('hermes-start-gateway'),
  hermesStopGateway: (): Promise<boolean> =>
    ipcRenderer.invoke('hermes-stop-gateway'),
  hermesGetStatus: (): Promise<{ running: boolean; apiKeyConfigured: boolean; cliAvailable: boolean }> =>
    ipcRenderer.invoke('hermes-get-status'),
  hermesResolveApiKey: (providerId: string): Promise<boolean> =>
    ipcRenderer.invoke('hermes-resolve-api-key', providerId),
  onHermesStatusChanged: (cb: (status: { running: boolean }) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, status: { running: boolean }): void => cb(status)
    ipcRenderer.on('hermes-status-changed', handler)
    return () => ipcRenderer.removeListener('hermes-status-changed', handler)
  }
} as const

export type AiGuiAPI = typeof api

contextBridge.exposeInMainWorld('mixDesktop', api)
