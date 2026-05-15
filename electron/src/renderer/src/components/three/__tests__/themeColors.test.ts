import { describe, it, expect } from 'vitest'
import { getPalette, DARK_PALETTE, LIGHT_PALETTE, CYBERPUNK_PALETTE } from '../themeColors'
import type { ThemePalette } from '../themeColors'

describe('themeColors', () => {
  describe('getPalette', () => {
    it('returns dark palette for "dark"', () => {
      expect(getPalette('dark')).toBe(DARK_PALETTE)
    })

    it('returns light palette for "light"', () => {
      expect(getPalette('light')).toBe(LIGHT_PALETTE)
    })

    it('returns cyberpunk palette for "cyberpunk"', () => {
      expect(getPalette('cyberpunk')).toBe(CYBERPUNK_PALETTE)
    })

    it('defaults to dark for unknown theme', () => {
      expect(getPalette('unknown')).toBe(DARK_PALETTE)
    })

    it('defaults to dark for empty string', () => {
      expect(getPalette('')).toBe(DARK_PALETTE)
    })
  })

  describe('palette structure', () => {
    const palettes: [string, ThemePalette][] = [
      ['dark', DARK_PALETTE],
      ['light', LIGHT_PALETTE],
      ['cyberpunk', CYBERPUNK_PALETTE],
    ]

    const requiredKeys: (keyof ThemePalette)[] = [
      'topFill', 'leftFill', 'rightFill',
      'woodLight', 'woodMid', 'woodDark',
      'metalLight', 'metalMid', 'metalDark',
      'screenGlow', 'fabricFill', 'fabricShadow',
      'floorFill', 'floorStroke',
      'wallFill', 'wallFill2', 'wallStroke',
      'windowFill', 'windowStroke',
      'plantLight', 'plantMid', 'plantDark',
      'potFill', 'potStroke',
      'outline', 'outlineW',
      'skin', 'skinShadow',
      'shadowOpacity', 'glowColor',
    ]

    for (const [name, palette] of palettes) {
      describe(`${name} palette`, () => {
        for (const key of requiredKeys) {
          it(`has ${key}`, () => {
            expect(palette[key]).toBeDefined()
            expect(typeof palette[key]).toBe('string')
            expect(palette[key].length).toBeGreaterThan(0)
          })
        }

        it('has valid hex colors for fills', () => {
          const hexKeys = ['topFill', 'leftFill', 'rightFill', 'floorFill'] as const
          for (const key of hexKeys) {
            expect(palette[key]).toMatch(/^#[0-9a-f]{6}$/i)
          }
        })
      })
    }
  })

  describe('palette distinctness', () => {
    it('dark and light have different floor colors', () => {
      expect(DARK_PALETTE.floorFill).not.toBe(LIGHT_PALETTE.floorFill)
    })

    it('cyberpunk has neon glow color', () => {
      expect(CYBERPUNK_PALETTE.glowColor).toBe('#00ffc8')
    })

    it('skin color is consistent across themes', () => {
      expect(DARK_PALETTE.skin).toBe(LIGHT_PALETTE.skin)
      expect(DARK_PALETTE.skin).toBe(CYBERPUNK_PALETTE.skin)
    })
  })
})
