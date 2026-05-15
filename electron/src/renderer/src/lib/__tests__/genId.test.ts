import { describe, it, expect } from 'vitest'
import { genId } from '../genId'

describe('genId', () => {
  it('returns a string', () => {
    expect(typeof genId()).toBe('string')
  })

  it('includes prefix when provided', () => {
    expect(genId('msg-')).toMatch(/^msg-/)
    expect(genId('test_')).toMatch(/^test_/)
  })

  it('generates unique IDs', () => {
    const ids = new Set<string>()
    for (let i = 0; i < 100; i++) {
      ids.add(genId())
    }
    expect(ids.size).toBe(100)
  })

  it('contains timestamp component', () => {
    const id = genId()
    const parts = id.split('-')
    expect(parts.length).toBeGreaterThanOrEqual(3)
    const tsPart = parts[0]
    expect(tsPart.length).toBeGreaterThan(0)
  })

  it('contains random component', () => {
    const id = genId()
    expect(id).toMatch(/-[a-z0-9]+$/)
  })

  it('prefix is empty string by default', () => {
    const id = genId()
    expect(id[0]).not.toBe('-')
  })

  it('generates different IDs in rapid succession', () => {
    const a = genId()
    const b = genId()
    expect(a).not.toBe(b)
  })
})
