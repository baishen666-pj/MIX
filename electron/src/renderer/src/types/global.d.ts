import type { AiGuiAPI } from '../../preload/index'

declare global {
  interface Window {
    mixDesktop: AiGuiAPI
  }
}

export {}
