import { create } from 'zustand'

export type ThemeMode = 'dark' | 'light' | 'cyberpunk'

function loadTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'dark'
  return (localStorage.getItem('ai-gui-theme') as ThemeMode) || 'dark'
}

function applyTheme(theme: ThemeMode) {
  document.documentElement.dataset.theme = theme
  localStorage.setItem('ai-gui-theme', theme)
}

interface ThemeState {
  theme: ThemeMode
  setTheme: (theme: ThemeMode) => void
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: loadTheme(),

  setTheme: (theme) => {
    applyTheme(theme)
    set({ theme })
  }
}))
