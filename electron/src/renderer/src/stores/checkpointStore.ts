import { create } from 'zustand'

export interface CheckpointItem {
  id: string
  sessionId: string
  description: string
  createdAt: number
  fileCount: number
}

interface CheckpointState {
  checkpoints: CheckpointItem[]
  isLoading: boolean
  error: string | null

  setCheckpoints: (items: CheckpointItem[]) => void
  addCheckpoint: (item: CheckpointItem) => void
  removeCheckpoint: (id: string) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  clearCheckpoints: () => void
}

export const useCheckpointStore = create<CheckpointState>((set) => ({
  checkpoints: [],
  isLoading: false,
  error: null,

  setCheckpoints: (items) => set({ checkpoints: items, error: null }),

  addCheckpoint: (item) =>
    set((s) => ({ checkpoints: [item, ...s.checkpoints] })),

  removeCheckpoint: (id) =>
    set((s) => ({
      checkpoints: s.checkpoints.filter((cp) => cp.id !== id)
    })),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  clearCheckpoints: () => set({ checkpoints: [], error: null })
}))
