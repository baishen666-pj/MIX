import { ipcMain, globalShortcut, BrowserWindow } from 'electron'
import { startBridge, stopBridge, isRunning, sendRequest, ensureDependencies } from './bridge'
import { checkRateLimit, recordAction, resetSession } from './safety'
import type { ComputerUseAction, ComputerUseResult, SafetyMode } from './types'

let safetyMode: SafetyMode = 'confirm'

export function registerComputerUseIpc(mainWindow: BrowserWindow): void {
  // Emergency stop: Ctrl+Shift+Escape
  globalShortcut.register('CommandOrControl+Shift+Escape', () => {
    stopBridge()
    resetSession()
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('cu-emergency-stop')
    }
  })

  ipcMain.handle('cu-start', async () => {
    try {
      await ensureDependencies()
      startBridge()
      // Wait for ping to confirm bridge is ready
      const res = await sendRequest('ping', {})
      return res.result !== undefined
    } catch (err: unknown) {
      return false
    }
  })

  ipcMain.handle('cu-stop', () => {
    stopBridge()
    resetSession()
    return true
  })

  ipcMain.handle('cu-status', async () => {
    const running = isRunning()
    let screenSize: { width: number; height: number } | undefined
    if (running) {
      try {
        const res = await sendRequest('screen_size', {})
        if (res.result) {
          screenSize = res.result as { width: number; height: number }
        }
      } catch {
        // Ignore
      }
    }
    return {
      running,
      safetyMode,
      actionCount: 0,
      screenSize
    }
  })

  ipcMain.handle('cu-action', async (_e, action: ComputerUseAction) => {
    if (!action || typeof action.method !== 'string') {
      return { ok: false, error: 'Invalid action' } as ComputerUseResult
    }

    if (!isRunning()) {
      return { ok: false, error: 'Bridge not running' } as ComputerUseResult
    }

    // Rate limit check
    const rateCheck = checkRateLimit()
    if (!rateCheck.allowed) {
      return { ok: false, error: rateCheck.reason } as ComputerUseResult
    }

    // Safety mode check
    if (safetyMode === 'confirm') {
      // Notify renderer to show confirmation dialog
      const approved = await requestConfirmation(mainWindow, action)
      if (!approved) {
        recordAction(action.method, action.params, safetyMode, false)
        return { ok: false, error: 'Action denied by user' } as ComputerUseResult
      }
    }

    // Execute action
    try {
      const res = await sendRequest(action.method, action.params)
      if (res.error) {
        recordAction(action.method, action.params, safetyMode, false)
        return { ok: false, error: res.error.message } as ComputerUseResult
      }
      recordAction(action.method, action.params, safetyMode, true)
      return { ok: true, data: res.result } as ComputerUseResult
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      recordAction(action.method, action.params, safetyMode, false)
      return { ok: false, error: msg } as ComputerUseResult
    }
  })

  ipcMain.handle('cu-screenshot', async () => {
    if (!isRunning()) {
      return { ok: false, error: 'Bridge not running' } as ComputerUseResult
    }
    try {
      const res = await sendRequest('screenshot', {})
      if (res.error) {
        return { ok: false, error: res.error.message } as ComputerUseResult
      }
      return { ok: true, data: res.result } as ComputerUseResult
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return { ok: false, error: msg } as ComputerUseResult
    }
  })

  ipcMain.handle('cu-set-safety', (_e, mode: string) => {
    if (mode !== 'confirm' && mode !== 'autonomous') {
      throw new Error('Invalid safety mode')
    }
    safetyMode = mode as SafetyMode
    return true
  })
}

function requestConfirmation(mainWindow: BrowserWindow, action: ComputerUseAction): Promise<boolean> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(false), 15000)

    const handler = (_e: Electron.IpcMainEvent, approved: boolean) => {
      clearTimeout(timeout)
      ipcMain.removeListener('cu-confirm-response', handler)
      resolve(approved)
    }

    ipcMain.on('cu-confirm-response', handler)

    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('cu-confirm-request', action)
    }
  })
}

export function cleanupComputerUse(): void {
  stopBridge()
  resetSession()
  try {
    globalShortcut.unregister('CommandOrControl+Shift+Escape')
  } catch {
    // Ignore
  }
}
