import { BrowserWindow, ipcMain } from 'electron'
import { autoUpdater } from 'electron-updater'

autoUpdater.autoDownload = false
autoUpdater.autoInstallOnAppQuit = true

export interface UpdateStatus {
  checking: boolean
  available: boolean
  downloading: boolean
  progress: number
  downloaded: boolean
  version: string | null
  error: string | null
}

let status: UpdateStatus = {
  checking: false,
  available: false,
  downloading: false,
  progress: 0,
  downloaded: false,
  version: null,
  error: null
}

function sendToRenderer(mainWindow: BrowserWindow, channel: string, data?: unknown): void {
  if (!mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data)
  }
}

function updateStatus(patch: Partial<UpdateStatus>): void {
  status = { ...status, ...patch }
}

export function initUpdater(mainWindow: BrowserWindow): void {
  autoUpdater.on('checking-for-update', () => {
    updateStatus({ checking: true, error: null })
    sendToRenderer(mainWindow, 'updater-status', status)
  })

  autoUpdater.on('update-available', (info) => {
    updateStatus({ checking: false, available: true, version: info.version })
    sendToRenderer(mainWindow, 'updater-available', { version: info.version })
    sendToRenderer(mainWindow, 'updater-status', status)
  })

  autoUpdater.on('update-not-available', () => {
    updateStatus({ checking: false, available: false })
    sendToRenderer(mainWindow, 'updater-status', status)
  })

  autoUpdater.on('download-progress', (progressInfo) => {
    updateStatus({ downloading: true, progress: Math.round(progressInfo.percent) })
    sendToRenderer(mainWindow, 'updater-progress', { percent: status.progress })
    sendToRenderer(mainWindow, 'updater-status', status)
  })

  autoUpdater.on('update-downloaded', (info) => {
    updateStatus({ downloading: false, downloaded: true, progress: 100 })
    sendToRenderer(mainWindow, 'updater-downloaded', { version: info.version })
    sendToRenderer(mainWindow, 'updater-status', status)
  })

  autoUpdater.on('error', (err) => {
    updateStatus({ checking: false, downloading: false, error: err.message })
    sendToRenderer(mainWindow, 'updater-error', { message: err.message })
    sendToRenderer(mainWindow, 'updater-status', status)
  })

  // IPC handlers
  ipcMain.handle('updater-check', async () => {
    try {
      await autoUpdater.checkForUpdates()
      return status
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      updateStatus({ error: msg })
      return status
    }
  })

  ipcMain.handle('updater-download', async () => {
    try {
      await autoUpdater.downloadUpdate()
      return true
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      updateStatus({ error: msg })
      return false
    }
  })

  ipcMain.handle('updater-install', () => {
    setImmediate(() => autoUpdater.quitAndInstall())
    return true
  })

  ipcMain.handle('updater-status', () => status)

  // Auto-check after 30 seconds, then every 4 hours
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {})
  }, 30000)

  setInterval(() => {
    autoUpdater.checkForUpdates().catch(() => {})
  }, 4 * 60 * 60 * 1000)
}
