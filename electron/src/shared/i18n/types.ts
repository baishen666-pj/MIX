export type AppLocale = 'zh-CN' | 'en'

export interface LocaleMessages {
  [key: string]: string | LocaleMessages
}
