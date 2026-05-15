import { create } from 'zustand'

interface ComputerUseState {
  isRunning: boolean
  safetyMode: 'confirm' | 'autonomous'
  lastScreenshot: string | null
  actionCount: number
  pendingAction: { method: string; params: Record<string, unknown> } | null
  emergencyStopped: boolean
  screenSize: { width: number; height: number } | null

  setRunning: (running: boolean) => void
  setSafetyMode: (mode: 'confirm' | 'autonomous') => void
  setLastScreenshot: (data: string | null) => void
  incrementActionCount: () => void
  setPendingAction: (action: { method: string; params: Record<string, unknown> } | null) => void
  setEmergencyStopped: (stopped: boolean) => void
  setScreenSize: (size: { width: number; height: number } | null) => void
  reset: () => void
}

export const useComputerUseStore = create<ComputerUseState>((set) => ({
  isRunning: false,
  safetyMode: 'confirm',
  lastScreenshot: null,
  actionCount: 0,
  pendingAction: null,
  emergencyStopped: false,
  screenSize: null,

  setRunning: (running) => set({ isRunning: running }),
  setSafetyMode: (mode) => set({ safetyMode: mode }),
  setLastScreenshot: (data) => set({ lastScreenshot: data }),
  incrementActionCount: () => set((s) => ({ actionCount: s.actionCount + 1 })),
  setPendingAction: (action) => set({ pendingAction: action }),
  setEmergencyStopped: (stopped) => set({ emergencyStopped: stopped }),
  setScreenSize: (size) => set({ screenSize: size }),
  reset: () => set({
    isRunning: false,
    lastScreenshot: null,
    actionCount: 0,
    pendingAction: null,
    emergencyStopped: false,
    screenSize: null
  })
}))
