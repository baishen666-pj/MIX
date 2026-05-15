/**
 * Pure workflow execution logic extracted from the WorkflowExecutor component.
 * No React or store dependencies — only pure functions and utilities.
 */

export const APPROVAL_KEYWORDS = ['审批', '确认', '人工', '人工审批', 'approve', 'confirm', 'human'] as const

export function isApprovalCondition(label: string, condition?: string): boolean {
  if (!condition && APPROVAL_KEYWORDS.some((kw) => label.toLowerCase().includes(kw))) return true
  if (condition && /{(human|approve|confirm)}/i.test(condition)) return true
  return false
}

export function evaluateCondition(condition: string, output: string): boolean {
  if (!condition) return true
  const c = condition.trim()
  if (c === 'yes' || c === 'true' || c === '1') return true
  if (c === 'no' || c === 'false' || c === '0') return false
  const containsMatch = c.match(/^contains:(.+)$/i)
  if (containsMatch) return output.toLowerCase().includes(containsMatch[1].toLowerCase())
  const lengthGt = c.match(/^length\s*>\s*(\d+)$/)
  if (lengthGt) return output.length > parseInt(lengthGt[1], 10)
  const lengthLt = c.match(/^length\s*<\s*(\d+)$/)
  if (lengthLt) return output.length < parseInt(lengthLt[1], 10)
  const lengthEq = c.match(/^length\s*==?\s*(\d+)$/)
  if (lengthEq) return output.length === parseInt(lengthEq[1], 10)
  return output.length > 0
}

export async function waitForStoreValue<T>(
  getSnapshot: () => T,
  predicate: (value: T) => boolean,
  timeoutMs = 30000
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      clearInterval(interval)
      reject(new Error(`waitForStoreValue timed out after ${timeoutMs}ms`))
    }, timeoutMs)

    const check = () => {
      const snapshot = getSnapshot()
      if (predicate(snapshot)) {
        clearTimeout(timer)
        clearInterval(interval)
        resolve(snapshot)
      }
    }

    check()
    const interval = setInterval(check, 200)
  })
}
