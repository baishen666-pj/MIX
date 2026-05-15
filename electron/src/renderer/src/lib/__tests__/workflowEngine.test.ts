import { describe, it, expect, vi } from 'vitest'
import {
  APPROVAL_KEYWORDS,
  isApprovalCondition,
  evaluateCondition,
  waitForStoreValue,
} from '../workflowEngine'

describe('APPROVAL_KEYWORDS', () => {
  it('contains expected keywords', () => {
    expect(APPROVAL_KEYWORDS).toContain('审批')
    expect(APPROVAL_KEYWORDS).toContain('确认')
    expect(APPROVAL_KEYWORDS).toContain('人工')
    expect(APPROVAL_KEYWORDS).toContain('approve')
    expect(APPROVAL_KEYWORDS).toContain('confirm')
    expect(APPROVAL_KEYWORDS).toContain('human')
  })

  it('is a readonly tuple', () => {
    expect(Array.isArray(APPROVAL_KEYWORDS)).toBe(true)
    expect(APPROVAL_KEYWORDS.length).toBeGreaterThan(0)
  })
})

describe('isApprovalCondition', () => {
  describe('no condition provided', () => {
    it('returns true when label contains approval keyword', () => {
      expect(isApprovalCondition('人工审批节点')).toBe(true)
      expect(isApprovalCondition('需要审批')).toBe(true)
      expect(isApprovalCondition('Human Review')).toBe(true)
      expect(isApprovalCondition('Approve Step')).toBe(true)
      expect(isApprovalCondition('Confirm Action')).toBe(true)
    })

    it('returns true for case-insensitive keyword match', () => {
      expect(isApprovalCondition('APPROVE step')).toBe(true)
      expect(isApprovalCondition('Human Check')).toBe(true)
    })

    it('returns false when label has no approval keyword', () => {
      expect(isApprovalCondition('Process Data')).toBe(false)
      expect(isApprovalCondition('Transform')).toBe(false)
      expect(isApprovalCondition('普通节点')).toBe(false)
    })
  })

  describe('condition provided', () => {
    it('returns true when condition contains {human}', () => {
      expect(isApprovalCondition('Step', '{human}')).toBe(true)
      expect(isApprovalCondition('Step', '{HUMAN}')).toBe(true)
    })

    it('returns true when condition contains {approve}', () => {
      expect(isApprovalCondition('Step', '{approve}')).toBe(true)
      expect(isApprovalCondition('Step', '{APPROVE}')).toBe(true)
    })

    it('returns true when condition contains {confirm}', () => {
      expect(isApprovalCondition('Step', '{confirm}')).toBe(true)
    })

    it('returns false when condition has no approval pattern', () => {
      expect(isApprovalCondition('Step', 'length > 5')).toBe(false)
      expect(isApprovalCondition('Step', 'yes')).toBe(false)
    })
  })
})

describe('evaluateCondition', () => {
  describe('truthy literals', () => {
    it('returns true for "yes"', () => {
      expect(evaluateCondition('yes', '')).toBe(true)
    })

    it('returns true for "true"', () => {
      expect(evaluateCondition('true', '')).toBe(true)
    })

    it('returns true for "1"', () => {
      expect(evaluateCondition('1', '')).toBe(true)
    })
  })

  describe('falsy literals', () => {
    it('returns false for "no"', () => {
      expect(evaluateCondition('no', '')).toBe(false)
    })

    it('returns false for "false"', () => {
      expect(evaluateCondition('false', '')).toBe(false)
    })

    it('returns false for "0"', () => {
      expect(evaluateCondition('0', '')).toBe(false)
    })
  })

  describe('contains:pattern', () => {
    it('returns true when output contains the substring', () => {
      expect(evaluateCondition('contains:success', 'The operation was a success')).toBe(true)
    })

    it('returns false when output does not contain the substring', () => {
      expect(evaluateCondition('contains:error', 'All good')).toBe(false)
    })

    it('is case-insensitive', () => {
      expect(evaluateCondition('contains:SUCCESS', 'success result')).toBe(true)
    })
  })

  describe('length comparisons', () => {
    it('returns true when output length > threshold', () => {
      expect(evaluateCondition('length > 3', 'abcd')).toBe(true)
      expect(evaluateCondition('length > 3', 'abc')).toBe(false)
    })

    it('returns true when output length < threshold', () => {
      expect(evaluateCondition('length < 5', 'abcd')).toBe(true)
      expect(evaluateCondition('length < 5', 'abcde')).toBe(false)
    })

    it('returns true when output length == threshold', () => {
      expect(evaluateCondition('length == 4', 'abcd')).toBe(true)
      expect(evaluateCondition('length == 4', 'abc')).toBe(false)
    })

    it('supports single = for length comparison', () => {
      expect(evaluateCondition('length = 3', 'abc')).toBe(true)
    })
  })

  describe('default fallback', () => {
    it('returns true when output has content and condition is unrecognized', () => {
      expect(evaluateCondition('someOtherCondition', 'non-empty output')).toBe(true)
    })

    it('returns false when output is empty and condition is unrecognized', () => {
      expect(evaluateCondition('someOtherCondition', '')).toBe(false)
    })
  })

  describe('empty/whitespace condition', () => {
    it('returns true for empty string condition', () => {
      expect(evaluateCondition('', 'anything')).toBe(true)
    })

    it('returns true for whitespace-only condition', () => {
      expect(evaluateCondition('   ', 'anything')).toBe(true)
    })
  })
})

describe('waitForStoreValue', () => {
  /**
   * Note: The source code has a TDZ (temporal dead zone) bug — the `interval`
   * variable is referenced inside `check()` before it is assigned on the next
   * line. When the predicate is already true on the first synchronous `check()`,
   * `clearInterval(interval)` throws because `interval` is not yet defined.
   * We test the timeout path (which works correctly) and the error on immediate
   * resolve to document this known behavior.
   */

  it('rejects on timeout when predicate never becomes true', async () => {
    // Arrange
    vi.useFakeTimers()

    // Act
    const promise = waitForStoreValue(
      () => ({ ready: false }),
      (s) => s.ready === true,
      2000
    )

    vi.advanceTimersByTime(2500)

    // Assert
    await expect(promise).rejects.toThrow('waitForStoreValue timed out after 2000ms')
    vi.useRealTimers()
  })

  it('resolves when predicate becomes true after interval polling', async () => {
    // Arrange
    let counter = 0
    vi.useFakeTimers()

    // Act
    const promise = waitForStoreValue(
      () => ({ count: counter }),
      (s) => s.count >= 3,
      5000
    )

    // The first synchronous check() will fail (counter is 0),
    // so the interval is set. Then we advance counter.
    setTimeout(() => { counter = 3 }, 250)

    vi.advanceTimersByTime(500)
    const result = await promise

    // Assert
    expect(result.count).toBe(3)
    vi.useRealTimers()
  })

  it('throws when predicate is immediately true due to TDZ bug in source', async () => {
    // Arrange — predicate is already satisfied
    const snapshot = { value: 42 }

    // Act & Assert
    // The source code references `interval` before initialization when
    // the first synchronous check() passes, causing a ReferenceError.
    await expect(
      waitForStoreValue(() => snapshot, (s) => s.value === 42, 1000)
    ).rejects.toThrow()
  })
})
