import { describe, it, expect } from 'vitest'
import {
  TILE_SIZE,
  toScreen,
  screenToGrid,
  sortKey,
  easeInOutCubic,
  roomRect,
  clamp,
} from '../PixelEngine'

describe('PixelEngine', () => {
  describe('TILE_SIZE', () => {
    it('is 32 pixels', () => {
      expect(TILE_SIZE).toBe(32)
    })
  })

  describe('toScreen', () => {
    it('converts grid (0,0) to screen (0,0)', () => {
      expect(toScreen(0, 0)).toEqual({ x: 0, y: 0 })
    })

    it('converts grid (1,1) to screen (32,32)', () => {
      expect(toScreen(1, 1)).toEqual({ x: 32, y: 32 })
    })

    it('converts grid (5,3) to screen (160,96)', () => {
      expect(toScreen(5, 3)).toEqual({ x: 160, y: 96 })
    })

    it('handles negative coordinates', () => {
      expect(toScreen(-2, -3)).toEqual({ x: -64, y: -96 })
    })

    it('handles fractional coordinates', () => {
      const result = toScreen(1.5, 2.5)
      expect(result.x).toBeCloseTo(48)
      expect(result.y).toBeCloseTo(80)
    })
  })

  describe('screenToGrid', () => {
    it('converts screen (0,0) to grid (0,0)', () => {
      expect(screenToGrid(0, 0)).toEqual({ x: 0, z: 0 })
    })

    it('converts screen (32,32) to grid (1,1)', () => {
      expect(screenToGrid(32, 32)).toEqual({ x: 1, z: 1 })
    })

    it('rounds to nearest grid', () => {
      expect(screenToGrid(20, 20)).toEqual({ x: 1, z: 1 })
      expect(screenToGrid(10, 10)).toEqual({ x: 0, z: 0 })
    })
  })

  describe('sortKey', () => {
    it('sorts by z first', () => {
      expect(sortKey(0, 2)).toBeGreaterThan(sortKey(0, 1))
    })

    it('sorts by x within same z', () => {
      expect(sortKey(3, 1)).toBeGreaterThan(sortKey(2, 1))
    })

    it('z dominates x', () => {
      expect(sortKey(0, 2)).toBeGreaterThan(sortKey(100, 1))
    })
  })

  describe('easeInOutCubic', () => {
    it('returns 0 at t=0', () => {
      expect(easeInOutCubic(0)).toBe(0)
    })

    it('returns 1 at t=1', () => {
      expect(easeInOutCubic(1)).toBeCloseTo(1)
    })

    it('returns 0.5 at t=0.5', () => {
      expect(easeInOutCubic(0.5)).toBeCloseTo(0.5)
    })

    it('is monotonically increasing', () => {
      const values = Array.from({ length: 11 }, (_, i) => easeInOutCubic(i / 10))
      for (let i = 1; i < values.length; i++) {
        expect(values[i]).toBeGreaterThan(values[i - 1])
      }
    })

    it('clamps values below 0', () => {
      expect(easeInOutCubic(-0.5)).toBeLessThan(0)
    })
  })

  describe('roomRect', () => {
    it('computes correct rectangle for 10x8 room at origin', () => {
      const r = roomRect(0, 0, 10, 8)
      expect(r.x).toBe(-5 * 32)
      expect(r.y).toBe(-4 * 32)
      expect(r.w).toBe(10 * 32)
      expect(r.h).toBe(8 * 32)
    })

    it('computes correct rectangle for offset room', () => {
      const r = roomRect(6, 4, 10, 8)
      expect(r.x).toBe((6 - 5) * 32)
      expect(r.y).toBe((4 - 4) * 32)
    })
  })

  describe('clamp', () => {
    it('clamps to min', () => {
      expect(clamp(-5, 0, 10)).toBe(0)
    })

    it('clamps to max', () => {
      expect(clamp(15, 0, 10)).toBe(10)
    })

    it('returns value within range', () => {
      expect(clamp(5, 0, 10)).toBe(5)
    })

    it('handles min === max', () => {
      expect(clamp(5, 3, 3)).toBe(3)
    })
  })
})
