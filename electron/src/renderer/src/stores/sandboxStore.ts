import { create } from 'zustand'

export type SandboxLevel = 'read-only' | 'workspace-write' | 'full-access'

export interface SandboxApproval {
  id: string
  operation: string
  detail: string
  level: SandboxLevel
  status: 'pending' | 'approved' | 'rejected'
  createdAt: number
}

interface SandboxState {
  level: SandboxLevel
  approvals: SandboxApproval[]
  projectDir: string | null

  setLevel: (level: SandboxLevel) => void
  setProjectDir: (dir: string | null) => void
  addApproval: (approval: SandboxApproval) => void
  respondApproval: (id: string, approved: boolean) => void
  clearApprovals: () => void
}

const STORED_LEVEL_KEY = 'ai-gui-sandbox-level'

function loadStoredLevel(): SandboxLevel {
  try {
    const stored = localStorage.getItem(STORED_LEVEL_KEY)
    if (stored === 'read-only' || stored === 'workspace-write' || stored === 'full-access') {
      return stored
    }
  } catch {
    // localStorage not available
  }
  return 'read-only'
}

function persistLevel(level: SandboxLevel): void {
  try {
    localStorage.setItem(STORED_LEVEL_KEY, level)
  } catch {
    // silently fail
  }
}

export const useSandboxStore = create<SandboxState>((set) => ({
  level: loadStoredLevel(),
  approvals: [],
  projectDir: null,

  setLevel: (level) => {
    persistLevel(level)
    set({ level })
  },

  setProjectDir: (projectDir) => set({ projectDir }),

  addApproval: (approval) =>
    set((s) => ({ approvals: [...s.approvals, approval] })),

  respondApproval: (id, approved) =>
    set((s) => ({
      approvals: s.approvals.map((a) =>
        a.id === id
          ? { ...a, status: approved ? ('approved' as const) : ('rejected' as const) }
          : a
      )
    })),

  clearApprovals: () => set({ approvals: [] })
}))
