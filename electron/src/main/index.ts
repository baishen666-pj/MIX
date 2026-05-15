import { app, BrowserWindow, Menu, ipcMain, shell, Notification, dialog, Tray, nativeImage } from 'electron'
import { execFile } from 'child_process'
import { join } from 'path'
import { writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import { checkGatewayHealth, readHermesApiKey, startGateway, stopGateway, getGatewayStatus } from './hermes'

import { enableGpuFlags } from './gpu'
import { getLocale, setLocale } from './locale'
import { getConnectionConfig, setConnectionConfig, getActiveProvider, setActiveProvider, updateProvider, removeProvider, setProviderModel } from './config'
import { discoverModels } from './model-discovery'
import { sendMessageWithLoop } from './chat'
import { openChatGPTLogin, logoutChatGPT, openSubscriptionLogin } from './auth'
import * as sessions from './sessions'
import * as persistence from './persistence'
import * as memory from './memory'
import * as checkpoint from './checkpoint'
import * as sandbox from './sandbox'
import { resolveAgentsConfig } from './agents-config'
import { registerBuiltinTools } from './tools'
import { startMcpServer, stopMcpServer } from './mcp'
import { connectStdioServer, disconnectServer, getConnectedServers, callExternalTool, disconnectAll, type McpServerConfig } from './mcp/client'
import { registerComputerUseIpc, cleanupComputerUse } from './computer-use'
import { initUpdater } from './updater'
import { registerImIpc, cleanupIm } from './im'
import { ProcessManager, type ProcessStatus } from './process-manager'

enableGpuFlags()

let mainWindow: BrowserWindow | null = null
let splashWindow: BrowserWindow | null = null
let activeChatController: AbortController | null = null
let processManager: ProcessManager | null = null

function createSplashWindow(): void {
  splashWindow = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false,
    transparent: true,
    resizable: false,
    center: true,
    alwaysOnTop: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  })

  const splashPath = join(__dirname, '../../resources/splash.html')
  if (existsSync(splashPath)) {
    splashWindow.loadFile(splashPath)
  }

  splashWindow.on('closed', () => { splashWindow = null })
}

function createTray(): Tray {
  const iconPath = join(__dirname, '../../resources/icon.png')
  const trayIcon = existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : nativeImage.createEmpty()
  const tray = new Tray(trayIcon)
  tray.setToolTip('MIX Agent')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '显示窗口', click: () => mainWindow?.show() },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() }
  ]))
  tray.on('click', () => mainWindow?.show())
  return tray
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    icon: join(__dirname, '../../resources/icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close()
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  const config = getConnectionConfig()
  const isServerMode = config.connectionMode === 'server'

  if (isServerMode) {
    createSplashWindow()
    processManager = new ProcessManager()
    processManager.onStatus((status: ProcessStatus) => {
      splashWindow?.webContents.send('process-status', status)
    })

    try {
      await processManager.startAll()
    } catch (err) {
      console.error('Failed to start server mode:', err)
    }
  }

  setupMenu()
  registerBuiltinTools()
  registerIpcHandlers()
  createWindow()
  createTray()
  startMcpServer().catch(() => { /* MCP server is optional */ })

  if (mainWindow) initUpdater(mainWindow)
  if (mainWindow) registerImIpc(mainWindow)

  // Auto-detect Hermes gateway on startup
  checkGatewayHealth().then(({ ok }) => {
    if (ok && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('hermes-status-changed', { running: true })
    }
    if (ok) {
      const config = getConnectionConfig()
      const hermesProvider = config.providers.find((p) => p.id === 'hermes')
      if (hermesProvider && !hermesProvider.apiKey) {
        const key = readHermesApiKey()
        if (key) updateProvider({ ...hermesProvider, apiKey: key })
      }
    }
  }).catch(() => { /* gateway not running, normal */ })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', async () => {
  await stopMcpServer()
  await disconnectAll()
  processManager?.stopAll()
})

function setupMenu(): void {
  const isMac = process.platform === 'darwin'

  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: '文件',
      submenu: [
        { label: '新对话', accelerator: 'CmdOrCtrl+N', click: () => mainWindow?.webContents.send('menu-new-chat') },
        { type: 'separator' },
        { label: '导出对话', accelerator: 'CmdOrCtrl+S', click: () => mainWindow?.webContents.send('menu-export') },
        { type: 'separator' },
        isMac ? { label: '关闭窗口', role: 'close' } : { label: '退出', role: 'quit', accelerator: 'CmdOrCtrl+Q' },
      ].filter(Boolean) as Electron.MenuItemConstructorOptions[],
    },
    {
      label: '编辑',
      submenu: [
        { label: '撤销', role: 'undo' },
        { label: '重做', role: 'redo' },
        { type: 'separator' },
        { label: '剪切', role: 'cut' },
        { label: '复制', role: 'copy' },
        { label: '粘贴', role: 'paste' },
        { label: '全选', role: 'selectAll' },
      ],
    },
    {
      label: '视图',
      submenu: [
        { label: '聊天', accelerator: 'CmdOrCtrl+1', click: () => mainWindow?.webContents.send('menu-nav', 'chat') },
        { label: 'Agent 画布', accelerator: 'CmdOrCtrl+2', click: () => mainWindow?.webContents.send('menu-nav', 'canvas') },
        { label: '办公室', accelerator: 'CmdOrCtrl+3', click: () => mainWindow?.webContents.send('menu-nav', '3d') },
        { label: '工作流', accelerator: 'CmdOrCtrl+4', click: () => mainWindow?.webContents.send('menu-nav', 'workflow') },
        { type: 'separator' },
        { label: '放大', role: 'zoomIn' },
        { label: '缩小', role: 'zoomOut' },
        { label: '重置缩放', role: 'resetZoom' },
        { type: 'separator' },
        { label: '全屏', role: 'togglefullscreen' },
        { type: 'separator' },
        { label: '开发者工具', role: 'toggleDevTools' },
      ],
    },
    {
      label: '窗口',
      submenu: [
        { label: '最小化', role: 'minimize' },
        { label: '缩放', role: 'zoom' },
        ...(isMac ? [
          { type: 'separator' as const },
          { label: '前置所有窗口', role: 'front' as const },
        ] : []),
      ],
    },
    {
      label: '帮助',
      submenu: [
        { label: '关于 MIX Agent', click: () => mainWindow?.webContents.send('menu-about') },
        { label: '快捷键', accelerator: 'CmdOrCtrl+/', click: () => mainWindow?.webContents.send('menu-shortcuts') },
      ],
    },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

app.on('window-all-closed', () => {
  cleanupComputerUse()
  cleanupIm()
  app.quit()
})

function registerIpcHandlers(): void {
  // Locale
  ipcMain.handle('get-locale', () => getLocale())
  ipcMain.handle('set-locale', (_e, locale: string) => setLocale(locale as 'zh-CN' | 'en'))

  // Config
  ipcMain.handle('get-connection-config', () => getConnectionConfig())
  ipcMain.handle('set-connection-config', (_e, config) => {
    setConnectionConfig(config)
    return true
  })

  ipcMain.handle('get-active-provider', () => getActiveProvider())

  ipcMain.handle('get-model-config', () => {
    const config = getConnectionConfig()
    const provider = config.providers.find((p) => p.id === config.activeProviderId) ?? config.providers[0]
    return { provider: provider.id, model: provider.defaultModel, baseUrl: provider.baseUrl }
  })

  ipcMain.handle('set-active-provider', (_e, id: string) => setActiveProvider(id))
  ipcMain.handle('update-provider', (_e, provider) => updateProvider(provider))
  ipcMain.handle('remove-provider', (_e, id: string) => removeProvider(id))
  ipcMain.handle('discover-models', async (_e, providerId: string) => {
    if (typeof providerId !== 'string') throw new Error('Invalid providerId')
    const config = getConnectionConfig()
    const provider = config.providers.find((p) => p.id === providerId)
    if (!provider) throw new Error('Provider not found')
    return discoverModels(provider)
  })
  ipcMain.handle('set-provider-model', (_e, providerId: string, model: string) => {
    if (typeof providerId !== 'string' || typeof model !== 'string') throw new Error('Invalid params')
    setProviderModel(providerId, model)
  })

  // Auth
  ipcMain.handle('chatgpt-login', () => openChatGPTLogin())
  ipcMain.handle('chatgpt-logout', () => logoutChatGPT())
  ipcMain.handle('subscription-login', async (_e, providerId: string) => {
    if (typeof providerId !== 'string') throw new Error('Invalid providerId')
    const config = getConnectionConfig()
    const provider = config.providers.find((p) => p.id === providerId)
    if (!provider) throw new Error('Provider not found')
    if (provider.authType !== 'subscription' && provider.type !== 'chatgpt') {
      throw new Error('Not a subscription provider')
    }
    // ChatGPT is the only subscription provider for now
    return openChatGPTLogin()
  })

  // Shell
  ipcMain.handle('open-external', (_e, url: string) => {
    try {
      const parsed = new URL(url)
      if (!['http:', 'https:'].includes(parsed.protocol)) return
      shell.openExternal(url)
    } catch { /* invalid URL */ }
  })

  // Chat
  ipcMain.handle('chat-send', (_e, opts) => {
    if (activeChatController) {
      activeChatController.abort()
      activeChatController = null
    }

    const win = mainWindow
    if (!win || win.isDestroyed()) return

    activeChatController = sendMessageWithLoop(opts, {
      onChunk(chunk) {
        if (!win.isDestroyed()) win.webContents.send('chat-chunk', chunk)
      },
      onToolProgress(tool) {
        if (!win.isDestroyed()) win.webContents.send('chat-tool-progress', tool)
      },
      onUsage(usage) {
        if (!win.isDestroyed()) win.webContents.send('chat-usage', usage)
      },
      onError(msg) {
        if (!win.isDestroyed()) win.webContents.send('chat-error', msg)
      },
      onDone() {
        if (!win.isDestroyed()) win.webContents.send('chat-done')
      },
      onReasoning(text) {
        if (!win.isDestroyed()) win.webContents.send('chat-reasoning', text)
      },
      onToolCallStart(call) {
        if (!win.isDestroyed()) win.webContents.send('chat-tool-call-start', call)
      },
      onToolCallResult(result) {
        if (!win.isDestroyed()) win.webContents.send('chat-tool-call-result', result)
      }
    })
  })

  ipcMain.handle('chat-abort', () => {
    if (activeChatController) {
      activeChatController.abort()
      activeChatController = null
    }
  })

  ipcMain.handle('list-tools', () => {
    const { listToolSpecs } = require('./tools/registry') as typeof import('./tools/registry')
    return listToolSpecs()
  })

  // Sessions
  ipcMain.handle('sessions-list', (_e, limit?: number) => sessions.listSessions(Math.min(limit ?? 50, 200)))
  ipcMain.handle('sessions-get-messages', (_e, sessionId: string) => {
    if (typeof sessionId !== 'string' || !sessionId) throw new Error('Invalid sessionId')
    return sessions.getSessionMessages(sessionId)
  })
  ipcMain.handle('sessions-create', (_e, id: string, model?: string) => {
    if (typeof id !== 'string' || !id) throw new Error('Invalid session id')
    return sessions.createSession(id, model)
  })
  ipcMain.handle('sessions-end', (_e, id: string) => {
    if (typeof id !== 'string' || !id) throw new Error('Invalid session id')
    return sessions.endSession(id)
  })
  ipcMain.handle('sessions-update-title', (_e, id: string, title: string) => {
    if (typeof id !== 'string' || !id) throw new Error('Invalid session id')
    return sessions.updateSessionTitle(id, String(title).slice(0, 200))
  })
  ipcMain.handle('sessions-delete', (_e, id: string) => {
    if (typeof id !== 'string' || !id) throw new Error('Invalid session id')
    return sessions.deleteSession(id)
  })
  ipcMain.handle('sessions-insert-message', (_e, msg) => {
    if (!msg || typeof msg.id !== 'string' || typeof msg.role !== 'string') throw new Error('Invalid message')
    return sessions.insertMessage(msg)
  })
  ipcMain.handle('sessions-search', (_e, query: string, limit?: number) => {
    if (typeof query !== 'string') throw new Error('Invalid query')
    return sessions.searchSessions(query, Math.min(limit ?? 20, 100))
  })

  // Notifications
  ipcMain.handle('send-notification', (_e, opts: { title: string; body: string; silent?: boolean }) => {
    if (!Notification.isSupported()) return false
    const notification = new Notification({
      title: opts.title,
      body: opts.body,
      silent: opts.silent ?? false,
      icon: join(__dirname, '../../resources/icon.png')
    })
    notification.show()
    return true
  })

  // Export
  ipcMain.handle('save-export', async (_e, opts: { content: string; fileName: string }) => {
    const safeName = opts.fileName.replace(/[/\\]/g, '_')
    const result = await dialog.showSaveDialog(mainWindow!, {
      defaultPath: join(app.getPath('documents'), safeName),
      filters: [
        { name: '所有文件', extensions: ['*'] },
        { name: 'Markdown', extensions: ['md'] },
        { name: 'JSON', extensions: ['json'] },
        { name: '文本', extensions: ['txt'] }
      ]
    })
    if (result.canceled || !result.filePath) return false
    await writeFile(result.filePath, opts.content, 'utf-8')
    return true
  })

  // Shell execution for code block run (restricted, no shell injection)
  const ALLOWED_SHELL_COMMANDS = ['node', 'python', 'python3', 'pip', 'npm', 'npx', 'echo', 'dir', 'ls', 'cat', 'pwd', 'whoami', 'date', 'git', 'curl']
  ipcMain.handle('run-shell', async (_e, command: string) => {
    const trimmed = command.trim()
    // Split into argv safely — no shell metacharacter interpretation
    const parts = trimmed.split(/\s+/)
    const baseCmd = parts[0].toLowerCase().replace(/\.(exe|cmd|bat|ps1)$/, '')
    if (!ALLOWED_SHELL_COMMANDS.includes(baseCmd)) {
      return `Error: command "${parts[0]}" is not allowed. Allowed: ${ALLOWED_SHELL_COMMANDS.join(', ')}`
    }
    return new Promise<string>((resolve) => {
      execFile(parts[0], parts.slice(1), { timeout: 10000, shell: false }, (error, stdout, stderr) => {
        if (error) resolve(`Error: ${error.message}\n${stderr}`)
        else resolve(stdout || stderr || '(no output)')
      })
    })
  })

  // Persistence — Scheduled Tasks
  ipcMain.handle('persistence-get-tasks', () => persistence.getAllTasks())
  ipcMain.handle('persistence-upsert-task', (_e, task) => persistence.upsertTask(task))
  ipcMain.handle('persistence-delete-task', (_e, id: string) => persistence.deleteTask(id))

  // Persistence — Workflows
  ipcMain.handle('persistence-get-workflows', () => persistence.getAllWorkflows())
  ipcMain.handle('persistence-upsert-workflow', (_e, wf) => persistence.upsertWorkflow(wf))
  ipcMain.handle('persistence-delete-workflow', (_e, id: string) => persistence.deleteWorkflow(id))

  // Memory System — MEMORY.md / USER.md / SOUL.md
  ipcMain.handle('memory-read', (_e, profile?: string) => {
    if (profile !== undefined && typeof profile !== 'string') throw new Error('Invalid profile')
    return memory.readMemory(profile)
  })
  ipcMain.handle('memory-read-entries', (_e, profile?: string) => {
    if (profile !== undefined && typeof profile !== 'string') throw new Error('Invalid profile')
    const raw = memory.readMemory(profile)
    return memory.parseMemoryEntries(raw)
  })
  ipcMain.handle('memory-add-entry', (_e, entry: { content: string; type: string; timestamp: number }, profile?: string) => {
    if (!entry || typeof entry.content !== 'string') throw new Error('Invalid entry')
    const validTypes = ['fact', 'preference', 'context', 'instruction']
    const type = validTypes.includes(entry.type) ? entry.type as memory.MemoryEntry['type'] : 'fact'
    return memory.addMemoryEntry({ content: entry.content, type, timestamp: entry.timestamp }, profile)
  })
  ipcMain.handle('memory-update-entry', (_e, id: string, content: string, profile?: string) => {
    if (typeof id !== 'string' || typeof content !== 'string') throw new Error('Invalid params')
    return memory.updateMemoryEntry(id, content, profile)
  })
  ipcMain.handle('memory-remove-entry', (_e, id: string, profile?: string) => {
    if (typeof id !== 'string') throw new Error('Invalid id')
    return memory.removeMemoryEntry(id, profile)
  })
  ipcMain.handle('memory-read-user-profile', (_e, profile?: string) => {
    if (profile !== undefined && typeof profile !== 'string') throw new Error('Invalid profile')
    return memory.readUserProfile(profile)
  })
  ipcMain.handle('memory-write-user-profile', (_e, content: string, profile?: string) => {
    if (typeof content !== 'string') throw new Error('Invalid content')
    memory.writeUserProfile(content, profile)
    return true
  })
  ipcMain.handle('memory-read-soul', (_e, profile?: string) => {
    if (profile !== undefined && typeof profile !== 'string') throw new Error('Invalid profile')
    return memory.readSoul(profile)
  })
  ipcMain.handle('memory-write-soul', (_e, content: string, profile?: string) => {
    if (typeof content !== 'string') throw new Error('Invalid content')
    memory.writeSoul(content, profile)
    return true
  })
  ipcMain.handle('memory-reset-soul', (_e, profile?: string) => {
    memory.resetSoul(profile)
    return true
  })

  // Agents Config — AGENTS.md / AGENTS.override.md
  ipcMain.handle('agents-config-resolve', (_e, workDir: string) => {
    if (typeof workDir !== 'string' || !workDir) throw new Error('Invalid workDir')
    return resolveAgentsConfig(workDir)
  })

  // Checkpoint — create / list / restore / delete
  let currentProjectDir: string | null = null

  ipcMain.handle('checkpoint-create', (_e, sessionId: string, description: string) => {
    if (typeof sessionId !== 'string' || !sessionId) throw new Error('Invalid sessionId')
    if (typeof description !== 'string') throw new Error('Invalid description')
    if (!currentProjectDir) throw new Error('No project directory set')
    return checkpoint.createCheckpoint(sessionId, description, currentProjectDir)
  })
  ipcMain.handle('checkpoint-list', (_e, sessionId?: string) => {
    const sid = sessionId && typeof sessionId === 'string' ? sessionId : 'default'
    return checkpoint.listCheckpoints(sid)
  })
  ipcMain.handle('checkpoint-restore', (_e, checkpointId: string) => {
    if (typeof checkpointId !== 'string' || !checkpointId) throw new Error('Invalid checkpointId')
    if (!currentProjectDir) throw new Error('No project directory set')
    return checkpoint.restoreCheckpoint(checkpointId, currentProjectDir)
  })
  ipcMain.handle('checkpoint-delete', (_e, checkpointId: string, sessionId: string) => {
    if (typeof checkpointId !== 'string' || !checkpointId) throw new Error('Invalid checkpointId')
    if (typeof sessionId !== 'string' || !sessionId) throw new Error('Invalid sessionId')
    return checkpoint.deleteCheckpoint(checkpointId, sessionId)
  })

  // Sandbox — level management and permission checks
  let currentSandboxLevel: sandbox.SandboxLevel = 'read-only'

  ipcMain.handle('sandbox-get-level', () => currentSandboxLevel)
  ipcMain.handle('sandbox-set-level', (_e, level: string) => {
    const validLevels: sandbox.SandboxLevel[] = ['read-only', 'workspace-write', 'full-access']
    if (!validLevels.includes(level as sandbox.SandboxLevel)) {
      throw new Error(`Invalid sandbox level: ${level}`)
    }
    currentSandboxLevel = level as sandbox.SandboxLevel
  })
  ipcMain.handle('sandbox-check-permission', (_e, operation: string) => {
    if (typeof operation !== 'string') throw new Error('Invalid operation')
    const validOps: sandbox.OperationType[] = ['read-file', 'write-file', 'execute-command', 'delete-file', 'access-system']
    if (!validOps.includes(operation as sandbox.OperationType)) {
      return { allowed: false, reason: `未知操作类型: ${operation}` }
    }
    return sandbox.checkPermission(currentSandboxLevel, operation as sandbox.OperationType)
  })
  ipcMain.handle('sandbox-validate-command', (_e, command: string) => {
    if (typeof command !== 'string') throw new Error('Invalid command')
    return sandbox.validateCommand(currentSandboxLevel, command)
  })

  // MCP — Server status
  ipcMain.handle('mcp-get-status', () => {
    const { getMcpServer } = require('./mcp') as typeof import('./mcp')
    const srv = getMcpServer()
    return { running: srv !== null }
  })

  // MCP — External client connections
  ipcMain.handle('mcp-connect-server', async (_e, config: McpServerConfig) => {
    if (!config || typeof config.id !== 'string') throw new Error('Invalid MCP server config')
    if (config.transport !== 'stdio') throw new Error('Only stdio transport is supported currently')
    return connectStdioServer(config)
  })

  ipcMain.handle('mcp-disconnect-server', async (_e, serverId: string) => {
    if (typeof serverId !== 'string') throw new Error('Invalid serverId')
    await disconnectServer(serverId)
    return true
  })

  ipcMain.handle('mcp-list-connected', () => {
    return getConnectedServers().map((s) => ({
      id: s.config.id,
      name: s.config.name,
      tools: s.tools
    }))
  })

  ipcMain.handle('mcp-call-tool', async (_e, serverId: string, toolName: string, args: Record<string, unknown>) => {
    if (typeof serverId !== 'string' || typeof toolName !== 'string') throw new Error('Invalid params')
    return callExternalTool(serverId, toolName, args)
  })

  // Computer Use — requires mainWindow for confirmation dialogs
  registerComputerUseIpc(mainWindow!)

  // Hermes Gateway
  ipcMain.handle('hermes-health-check', async () => checkGatewayHealth())
  ipcMain.handle('hermes-read-api-key', () => {
    const key = readHermesApiKey()
    return { configured: key.length > 0, key }
  })
  ipcMain.handle('hermes-start-gateway', async () => startGateway())
  ipcMain.handle('hermes-stop-gateway', async () => stopGateway())
  ipcMain.handle('hermes-get-status', async () => getGatewayStatus())
  ipcMain.handle('hermes-resolve-api-key', (_e, providerId: string) => {
    if (typeof providerId !== 'string') throw new Error('Invalid providerId')
    const { readHermesApiKey } = require('./hermes') as typeof import('./hermes')
    const config = getConnectionConfig()
    const provider = config.providers.find((p) => p.id === providerId)
    if (!provider) throw new Error('Provider not found')
    if (!provider.apiKey) {
      const key = readHermesApiKey()
      if (key) updateProvider({ ...provider, apiKey: key })
    }
    return true
  })

  // MIX ProcessManager — server mode status
  ipcMain.handle('process-get-status', () => ({
    ready: processManager?.isReady() ?? false,
    mode: getConnectionConfig().connectionMode
  }))

  ipcMain.handle('process-restart', async () => {
    processManager?.stopAll()
    await new Promise((r) => setTimeout(r, 1000))
    await processManager?.startAll()
    return processManager?.isReady() ?? false
  })
}
