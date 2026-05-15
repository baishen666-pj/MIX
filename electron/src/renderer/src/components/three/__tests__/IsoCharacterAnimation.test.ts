import { describe, it, expect } from 'vitest'
import {
  getIrisColor,
  getBounce,
  getLimbAngles,
  getExpression,
} from '../IsoCharacterAnimation'
import type { Expression } from '../IsoCharacterAnimation'

describe('getIrisColor', () => {
  it('returns mapped color for known roles', () => {
    expect(getIrisColor('boss', '#000')).toBe('#6366f1')
    expect(getIrisColor('pm', '#000')).toBe('#3b82f6')
    expect(getIrisColor('developer', '#000')).toBe('#22c55e')
    expect(getIrisColor('designer', '#000')).toBe('#ec4899')
    expect(getIrisColor('tester', '#000')).toBe('#f59e0b')
    expect(getIrisColor('worker', '#000')).toBe('#a78bfa')
  })

  it('falls back to provided color for unknown role', () => {
    expect(getIrisColor('unknown' as any, '#ff0000')).toBe('#ff0000')
    expect(getIrisColor('other' as any, '#abcdef')).toBe('#abcdef')
  })
})

describe('getBounce', () => {
  it('idle produces sinusoidal bounce', () => {
    const atZero = getBounce('idle', 0)
    expect(atZero).toBeCloseTo(0, 1)

    // At t=PI/(2*2.4), sin reaches 1, so bounce = 1.5
    const peak = getBounce('idle', Math.PI / (2 * 2.4))
    expect(peak).toBeCloseTo(1.5, 1)
  })

  it('working returns 0 (no bounce)', () => {
    expect(getBounce('working', 0)).toBe(0)
    expect(getBounce('working', 5)).toBe(0)
    expect(getBounce('working', 100)).toBe(0)
  })

  it('meeting produces gentle bounce', () => {
    const bounce = getBounce('meeting', 1)
    expect(typeof bounce).toBe('number')
    // Should be within amplitude range
    expect(Math.abs(bounce)).toBeLessThanOrEqual(1)
  })

  it('walking produces bouncy movement', () => {
    const bounce = getBounce('walking', 0)
    expect(bounce).toBe(0)

    // Walking bounce uses abs(sin(t*12)) * 3, always >= 0
    const midBounce = getBounce('walking', 0.1)
    expect(midBounce).toBeGreaterThanOrEqual(0)
    expect(midBounce).toBeLessThanOrEqual(3)
  })

  it('submitting produces bounce', () => {
    const bounce = getBounce('submitting', 0.5)
    expect(typeof bounce).toBe('number')
    expect(Math.abs(bounce)).toBeLessThanOrEqual(3)
  })

  it('unknown activity returns 0', () => {
    expect(getBounce('unknown' as any, 0)).toBe(0)
  })
})

describe('getLimbAngles', () => {
  it('idle has small arm angles and zero leg angles', () => {
    const angles = getLimbAngles('idle', 0)
    expect(angles.leftArm).toBe(5)
    expect(angles.rightArm).toBe(-5)
    expect(angles.leftLeg).toBe(0)
    expect(angles.rightLeg).toBe(0)
  })

  it('working has forward arm angles with animation', () => {
    const angles = getLimbAngles('working', 0)
    expect(angles.leftArm).toBeLessThan(0)
    expect(angles.rightArm).toBeLessThan(0)
    expect(angles.leftLeg).toBe(0)
    expect(angles.rightLeg).toBe(0)
  })

  it('meeting has mixed arm angles', () => {
    const angles = getLimbAngles('meeting', 0)
    expect(typeof angles.leftArm).toBe('number')
    expect(angles.rightArm).toBe(5)
    expect(angles.leftLeg).toBe(0)
    expect(angles.rightLeg).toBe(0)
  })

  it('walking has oscillating arms and legs', () => {
    const angles = getLimbAngles('walking', 0)
    expect(angles.leftArm).toBeCloseTo(0, 10)
    expect(angles.rightArm).toBeCloseTo(0, 10)
    expect(angles.leftLeg).toBeCloseTo(0, 10)
    expect(angles.rightLeg).toBeCloseTo(0, 10)

    // At non-zero time, limbs should oscillate
    const inMotion = getLimbAngles('walking', 0.3)
    expect(typeof inMotion.leftArm).toBe('number')
    expect(typeof inMotion.rightArm).toBe('number')
  })

  it('submitting has right arm raised', () => {
    const angles = getLimbAngles('submitting', 0)
    expect(angles.leftArm).toBe(-10)
    expect(angles.rightArm).toBe(-60)
    expect(angles.leftLeg).toBe(0)
    expect(angles.rightLeg).toBe(0)
  })

  it('unknown activity returns zero angles', () => {
    const angles = getLimbAngles('unknown' as any, 0)
    expect(angles.leftArm).toBe(0)
    expect(angles.rightArm).toBe(0)
    expect(angles.leftLeg).toBe(0)
    expect(angles.rightLeg).toBe(0)
  })

  it('returns all numeric values', () => {
    const activities = ['idle', 'working', 'meeting', 'walking', 'submitting'] as const
    for (const activity of activities) {
      const angles = getLimbAngles(activity, Math.random() * 10)
      expect(typeof angles.leftArm).toBe('number')
      expect(typeof angles.rightArm).toBe('number')
      expect(typeof angles.leftLeg).toBe('number')
      expect(typeof angles.rightLeg).toBe('number')
    }
  })
})

describe('getExpression', () => {
  it('returns focused for working', () => {
    expect(getExpression('working')).toBe('focused')
  })

  it('returns thinking for meeting', () => {
    expect(getExpression('meeting')).toBe('thinking')
  })

  it('returns worried for submitting', () => {
    expect(getExpression('submitting')).toBe('worried')
  })

  it('returns neutral for idle', () => {
    expect(getExpression('idle')).toBe('neutral')
  })

  it('returns neutral for walking', () => {
    expect(getExpression('walking')).toBe('neutral')
  })

  it('returns neutral for unknown activity', () => {
    expect(getExpression('unknown' as any)).toBe('neutral')
  })

  it('all return values are valid Expression types', () => {
    const validExpressions: Expression[] = ['neutral', 'focused', 'happy', 'worried', 'thinking']
    const activities = ['idle', 'working', 'meeting', 'walking', 'submitting'] as const
    for (const activity of activities) {
      const expr = getExpression(activity)
      expect(validExpressions).toContain(expr)
    }
  })
})
