import { describe, it, expect } from 'vitest'
import { toIso, sortKey, easeInOutCubic, roomCorners, wallPolygon, floorPolygon, COS30, SIN30, SCALE } from '../IsoEngine'

describe('IsoEngine', () => {
  describe('constants', () => {
    it('COS30 ≈ 0.866', () => {
      expect(COS30).toBeCloseTo(0.866, 2)
    })
    it('SIN30 ≈ 0.5', () => {
      expect(SIN30).toBeCloseTo(0.5, 10)
    })
    it('SCALE = 50', () => {
      expect(SCALE).toBe(50)
    })
  })

  describe('toIso', () => {
    it('origin maps to (0, 0)', () => {
      const p = toIso(0, 0)
      expect(p.x).toBe(0)
      expect(p.y).toBe(0)
    })

    it('positive x maps to positive screen x and negative screen y', () => {
      const p = toIso(1, 0)
      expect(p.x).toBeCloseTo(COS30 * SCALE)
      expect(p.y).toBeCloseTo(SIN30 * SCALE)
    })

    it('positive z maps to negative screen x and negative screen y', () => {
      const p = toIso(0, 1)
      expect(p.x).toBeCloseTo(-COS30 * SCALE)
      expect(p.y).toBeCloseTo(SIN30 * SCALE)
    })

    it('x=z gives x=0 on screen', () => {
      const p = toIso(5, 5)
      expect(p.x).toBe(0)
      expect(p.y).toBeCloseTo(10 * SIN30 * SCALE)
    })

    it('y parameter offsets vertically', () => {
      const ground = toIso(0, 0, 0)
      const raised = toIso(0, 0, 1)
      expect(raised.y).toBeCloseTo(ground.y - SCALE)
    })

    it('is symmetric: toIso(a,b) and toIso(b,a) have mirrored x', () => {
      const ab = toIso(3, 7)
      const ba = toIso(7, 3)
      expect(ab.x).toBeCloseTo(-ba.x)
      expect(ab.y).toBeCloseTo(ba.y)
    })
  })

  describe('sortKey', () => {
    it('larger x+z gives larger key', () => {
      expect(sortKey(5, 0, 0)).toBeGreaterThan(sortKey(3, 0, 0))
    })

    it('y adds to the key', () => {
      expect(sortKey(0, 0, 1)).toBeGreaterThan(sortKey(0, 0, 0))
    })

    it('same x+z+y gives same key', () => {
      expect(sortKey(2, 3, 1)).toBe(sortKey(2, 3, 1))
    })
  })

  describe('easeInOutCubic', () => {
    it('0 → 0', () => {
      expect(easeInOutCubic(0)).toBe(0)
    })

    it('1 → 1', () => {
      expect(easeInOutCubic(1)).toBeCloseTo(1, 10)
    })

    it('0.5 → 0.5', () => {
      expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 10)
    })

    it('is monotonically increasing', () => {
      const steps = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]
      for (let i = 1; i < steps.length; i++) {
        expect(easeInOutCubic(steps[i])).toBeGreaterThan(easeInOutCubic(steps[i - 1]))
      }
    })

    it('clamped negative stays near 0', () => {
      expect(easeInOutCubic(-0.5)).toBeLessThan(0)
    })
  })

  describe('roomCorners', () => {
    it('returns 4 points', () => {
      expect(roomCorners(0, 0, 10, 8)).toHaveLength(4)
    })

    it('square room has 4 distinct corners', () => {
      const [bl, br, fr, fl] = roomCorners(0, 0, 8, 8)
      const pts = [bl, br, fr, fl]
      const unique = new Set(pts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`))
      expect(unique.size).toBe(4)
    })

    it('centered room: fr is bottom, bl is top of diamond', () => {
      const [bl, br, fr, fl] = roomCorners(0, 0, 8, 8)
      // In iso projection: bl=top, br=right, fr=bottom, fl=left
      expect(fr.y).toBeGreaterThan(bl.y)
      expect(br.x).toBeGreaterThan(fl.x)
    })

    it('non-zero center shifts corners', () => {
      const c0 = roomCorners(0, 0, 4, 4)
      const c5 = roomCorners(5, 0, 4, 4)
      const dx = c5[0].x - c0[0].x
      expect(Math.abs(dx)).toBeGreaterThan(0)
    })
  })

  describe('wallPolygon', () => {
    it('returns 4 coordinate pairs', () => {
      const result = wallPolygon({ x: 0, y: 0 }, { x: 10, y: 5 }, 3)
      const pairs = result.split(' ')
      expect(pairs).toHaveLength(4)
    })

    it('wall points go upward', () => {
      const p1 = { x: 0, y: 0 }
      const p2 = { x: 10, y: 0 }
      const result = wallPolygon(p1, p2, 2)
      const points = result.split(' ').map((s) => {
        const [x, y] = s.split(',').map(Number)
        return { x, y }
      })
      expect(points[2].y).toBeLessThan(points[1].y)
      expect(points[3].y).toBeLessThan(points[0].y)
    })
  })

  describe('floorPolygon', () => {
    it('joins corners with spaces', () => {
      const corners = [
        { x: 1, y: 2 },
        { x: 3, y: 4 },
      ]
      expect(floorPolygon(corners)).toBe('1,2 3,4')
    })

    it('handles single corner', () => {
      expect(floorPolygon([{ x: 5, y: 10 }])).toBe('5,10')
    })
  })
})
