declare module 'react-syntax-highlighter/dist/esm/prism-light' {
  import { ComponentType } from 'react'
  const PrismLight: ComponentType<Record<string, unknown>>
  export default PrismLight
  export const registerLanguage: (name: string, lang: Record<string, unknown>) => void
}

declare module 'react-syntax-highlighter/dist/esm/languages/prism/*' {
  const language: { default: Record<string, unknown> }
  export default language
}
