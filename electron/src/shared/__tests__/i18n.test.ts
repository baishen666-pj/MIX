import { describe, it, expect } from 'vitest'
import { en } from '../i18n/en'
import { zhCN } from '../i18n/zh-CN'
import type { LocaleMessages } from '../i18n/types'

function collectKeys(obj: LocaleMessages, prefix = ''): string[] {
  const keys: string[] = []
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'string') {
      keys.push(fullKey)
    } else {
      keys.push(...collectKeys(value, fullKey))
    }
  }
  return keys
}

describe('i18n key consistency', () => {
  it('zh-CN and en have identical key sets', () => {
    const enKeys = collectKeys(en).sort()
    const zhKeys = collectKeys(zhCN).sort()
    expect(zhKeys).toEqual(enKeys)
  })

  it('no empty values in en', () => {
    const keys = collectKeys(en)
    for (const key of keys) {
      const parts = key.split('.')
      let obj: LocaleMessages | string = en
      for (const p of parts) {
        obj = (obj as LocaleMessages)[p]
      }
      expect(obj).not.toBe('')
    }
  })

  it('no empty values in zh-CN', () => {
    const keys = collectKeys(zhCN)
    for (const key of keys) {
      const parts = key.split('.')
      let obj: LocaleMessages | string = zhCN
      for (const p of parts) {
        obj = (obj as LocaleMessages)[p]
      }
      expect(obj).not.toBe('')
    }
  })
})

describe('en locale', () => {
  it('has app.title', () => {
    expect((en.app as LocaleMessages).title).toBe('AI GUI')
  })

  it('has chat section', () => {
    expect((en.chat as LocaleMessages).placeholder).toBeTruthy()
    expect((en.chat as LocaleMessages).send).toBeTruthy()
  })

  it('has settings section', () => {
    expect((en.settings as LocaleMessages).title).toBeTruthy()
  })
})

describe('zh-CN locale', () => {
  it('has app.title', () => {
    expect((zhCN.app as LocaleMessages).title).toBe('AI GUI')
  })

  it('has sidebar section', () => {
    expect((zhCN.sidebar as LocaleMessages).chat).toBeTruthy()
    expect((zhCN.sidebar as LocaleMessages).canvas).toBeTruthy()
  })

  it('has common section', () => {
    expect((zhCN.common as LocaleMessages).loading).toBeTruthy()
    expect((zhCN.common as LocaleMessages).error).toBeTruthy()
  })
})
