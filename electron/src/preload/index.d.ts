import type { AiGuiAPI } from './index'

declare global {
  interface Window {
    mixDesktop: AiGuiAPI
  }
}
