import { describe, it, expect } from 'vitest'
import { detectDangerousContent, CATEGORY_LABELS } from '../approvalDetection'
import type { DangerCategory } from '../approvalDetection'

describe('detectDangerousContent', () => {
  describe('safe content', () => {
    it('returns not detected for empty string', () => {
      const r = detectDangerousContent('')
      expect(r.detected).toBe(false)
    })

    it('returns not detected for short strings', () => {
      expect(detectDangerousContent('hello').detected).toBe(false)
    })

    it('returns not detected for normal code', () => {
      expect(detectDangerousContent('const x = add(1, 2); return x;').detected).toBe(false)
    })

    it('returns not detected for safe git commands', () => {
      expect(detectDangerousContent('git commit -m "feat: add feature"').detected).toBe(false)
    })
  })

  describe('file_delete', () => {
    it('detects rm -rf', () => {
      const r = detectDangerousContent('rm -rf /tmp/old')
      expect(r.detected).toBe(true)
      expect(r.category).toBe('file_delete')
      expect(r.confidence).toBe('high')
    })

    it('detects DROP TABLE', () => {
      const r = detectDangerousContent('DROP TABLE users;')
      expect(r.detected).toBe(true)
      expect(r.category).toBe('file_delete')
    })

    it('detects fs.unlink', () => {
      const r = detectDangerousContent('const result = fs.unlink("/path/to/some/file/that/exists")')
      expect(r.detected).toBe(true)
      expect(r.category).toBe('file_delete')
    })
  })

  describe('shell_exec', () => {
    it('detects os.system call', () => {
      const r = detectDangerousContent('os.system("ls -la")')
      expect(r.detected).toBe(true)
      expect(r.category).toBe('shell_exec')
      expect(r.confidence).toBe('high')
    })

    it('detects eval', () => {
      const r = detectDangerousContent('eval("console.log(1)")')
      expect(r.detected).toBe(true)
      expect(r.category).toBe('shell_exec')
    })

    it('detects spawn', () => {
      const r = detectDangerousContent('child_process.spawn("ls")')
      expect(r.detected).toBe(true)
      expect(r.category).toBe('shell_exec')
    })
  })

  describe('db_destructive', () => {
    it('detects TRUNCATE', () => {
      const r = detectDangerousContent('TRUNCATE TABLE logs;')
      expect(r.detected).toBe(true)
      expect(r.category).toBe('db_destructive')
    })

    it('detects DELETE FROM without WHERE', () => {
      const r = detectDangerousContent('DELETE FROM users;')
      expect(r.detected).toBe(true)
      expect(r.category).toBe('db_destructive')
    })
  })

  describe('system_modify', () => {
    it('detects npm uninstall', () => {
      const r = detectDangerousContent('npm uninstall react')
      expect(r.detected).toBe(true)
      expect(r.category).toBe('system_modify')
    })

    it('detects kill -9', () => {
      const r = detectDangerousContent('kill -9 1234')
      expect(r.detected).toBe(true)
      expect(r.category).toBe('system_modify')
      expect(r.confidence).toBe('high')
    })

    it('detects docker rm', () => {
      const r = detectDangerousContent('docker rm container_name')
      expect(r.detected).toBe(true)
      expect(r.category).toBe('system_modify')
    })
  })

  describe('deploy_publish', () => {
    it('detects git push --force', () => {
      const r = detectDangerousContent('git push --force origin main')
      expect(r.detected).toBe(true)
      expect(r.category).toBe('deploy_publish')
      expect(r.confidence).toBe('high')
    })

    it('detects git reset --hard', () => {
      const r = detectDangerousContent('git reset --hard HEAD~5')
      expect(r.detected).toBe(true)
      expect(r.category).toBe('deploy_publish')
    })

    it('detects kubectl delete', () => {
      const r = detectDangerousContent('kubectl delete pod my-app')
      expect(r.detected).toBe(true)
      expect(r.category).toBe('deploy_publish')
    })
  })

  describe('env_secret', () => {
    it('detects api_key assignment', () => {
      const r = detectDangerousContent('api_key = "sk-proj-xxxxx"')
      expect(r.detected).toBe(true)
      expect(r.category).toBe('env_secret')
      expect(r.confidence).toBe('high')
    })

    it('detects process.env assignment', () => {
      const r = detectDangerousContent('process.env.NODE_ENV = "production"')
      expect(r.detected).toBe(true)
      expect(r.category).toBe('env_secret')
    })
  })

  describe('mass_change', () => {
    it('detects refactor all', () => {
      const r = detectDangerousContent('refactor all the code')
      expect(r.detected).toBe(true)
      expect(r.category).toBe('mass_change')
    })

    it('detects delete every file', () => {
      const r = detectDangerousContent('delete every file in the directory')
      expect(r.detected).toBe(true)
      expect(r.category).toBe('mass_change')
    })
  })

  describe('priority: high over medium', () => {
    it('returns high confidence when both high and medium match', () => {
      const r = detectDangerousContent('rm -rf /tmp && npm uninstall lodash')
      expect(r.confidence).toBe('high')
    })
  })

  describe('result shape', () => {
    it('detected result has all required fields', () => {
      const r = detectDangerousContent('rm -rf /old')
      expect(r).toHaveProperty('detected', true)
      expect(r).toHaveProperty('category')
      expect(r).toHaveProperty('summary')
      expect(r).toHaveProperty('confidence')
      expect(r).toHaveProperty('matchedPattern')
    })

    it('non-detected result has null fields', () => {
      const r = detectDangerousContent('just some normal text here okay')
      expect(r.detected).toBe(false)
      expect(r.category).toBeNull()
      expect(r.matchedPattern).toBeNull()
    })
  })
})

describe('CATEGORY_LABELS', () => {
  it('has a label for every category', () => {
    const categories: DangerCategory[] = [
      'file_delete', 'shell_exec', 'db_destructive',
      'system_modify', 'deploy_publish', 'env_secret', 'mass_change',
    ]
    for (const cat of categories) {
      expect(CATEGORY_LABELS[cat]).toBeDefined()
      expect(CATEGORY_LABELS[cat].length).toBeGreaterThan(0)
    }
  })

  it('all labels are Chinese text', () => {
    for (const label of Object.values(CATEGORY_LABELS)) {
      expect(label).toMatch(/[一-鿿]/)
    }
  })
})
