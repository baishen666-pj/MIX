import { describe, it, expect, beforeEach } from 'vitest'

// Mock browser globals before importing the store
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
  }
})()

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock })
Object.defineProperty(globalThis, 'document', { value: { documentElement: { dataset: {} } }, writable: true })

import { useThemeStore } from '../themeStore'

describe('themeStore', () => {
  beforeEach(() => {
    useThemeStore.setState({ theme: 'dark' })
    localStorageMock.clear()
  })

  describe('initial state', () => {
    it('defaults to dark theme', () => {
      expect(useThemeStore.getState().theme).toBe('dark')
    })
  })

  describe('setTheme', () => {
    it('changes to light theme', () => {
      useThemeStore.getState().setTheme('light')
      expect(useThemeStore.getState().theme).toBe('light')
    })

    it('changes to cyberpunk theme', () => {
      useThemeStore.getState().setTheme('cyberpunk')
      expect(useThemeStore.getState().theme).toBe('cyberpunk')
    })

    it('cycles through all themes', () => {
      useThemeStore.getState().setTheme('light')
      expect(useThemeStore.getState().theme).toBe('light')
      useThemeStore.getState().setTheme('cyberpunk')
      expect(useThemeStore.getState().theme).toBe('cyberpunk')
      useThemeStore.getState().setTheme('dark')
      expect(useThemeStore.getState().theme).toBe('dark')
    })
  })
})
