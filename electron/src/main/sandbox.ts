import { resolve, relative, sep } from 'path'

/**
 * Three-tier sandbox security model, inspired by OpenAI Codex.
 *
 * - read-only: AI can only read files, cannot modify or execute commands
 * - workspace-write: AI can write files and execute commands within project directory
 * - full-access: Full access (requires user double-confirmation)
 */
export type SandboxLevel = 'read-only' | 'workspace-write' | 'full-access'

export type OperationType = 'read-file' | 'write-file' | 'execute-command' | 'delete-file' | 'access-system'

interface PermissionResult {
  allowed: boolean
  reason: string | null
}

/**
 * Dangerous command patterns that should be blocked.
 * These apply even in full-access mode with a warning.
 */
const DANGEROUS_COMMAND_PATTERNS: RegExp[] = [
  /\brm\s+(-[a-zA-Z]*f[a-zA-Z]*\s+|.*--no-preserve-root.*)\//i,
  /\bformat\s+[a-zA-Z]:/i,
  /\bdel\s+\/[sS]/i,
  /\bmkfs\b/i,
  /\bdd\s+if=/i,
  /\b(shutdown|reboot)\b/i,
  /\b(systemctl|service)\s+(stop|disable|restart)\b/i,
  /\b(npm|yarn|pnpm)\s+publish\b/i,
  /\bgit\s+push\s+.*--force/i,
  /\bcurl\s+.*\|\s*(ba)?sh/i,
  /\bwget\s+.*\|\s*(ba)?sh/i,
  /\bchmod\s+(-R\s+)?777\b/i,
  /\bchown\s+(-R\s+)?root/i,
  /\b(iptables|ufw|firewall-cmd)\b/i,
  /\breg\s+(add|delete)\b/i,
  /\bpowershell\s+-enc/i,
  /\bcmd\s+\/c/i,
  /\btaskkill\s+\/[fF]/i,
  /\bnet\s+(user|localgroup)\b/i,
  /\bvssadmin\s+delete/i,
  /\bwbadmin\s+delete/i,
  /\bcd\b.*&&\s*(rm|del|rmdir)/i,
]

/**
 * Commands allowed in workspace-write mode.
 * Restricted to common development tools.
 */
const WORKSPACE_ALLOWED_COMMANDS: string[] = [
  'node', 'npm', 'npx', 'yarn', 'pnpm', 'bun', 'deno',
  'git', 'python', 'python3', 'pip', 'pip3',
  'echo', 'cat', 'ls', 'dir', 'pwd', 'whoami', 'date',
  'grep', 'find', 'head', 'tail', 'wc', 'sort', 'uniq',
  'mkdir', 'touch', 'cp', 'mv',
  'tsc', 'eslint', 'prettier', 'vitest', 'jest',
  'cargo', 'go', 'rustc', 'rustup',
  'curl', 'wget',
  'dotnet', 'java', 'javac',
]

/**
 * Check whether a given operation is permitted under the specified sandbox level.
 */
export function checkPermission(level: SandboxLevel, operation: OperationType): PermissionResult {
  switch (level) {
    case 'read-only':
      if (operation === 'read-file') {
        return { allowed: true, reason: null }
      }
      return {
        allowed: false,
        reason: `当前沙箱级别「只读」不允许执行「${operationLabel(operation)}」操作。请切换到「工作区写入」或「完全访问」级别。`
      }

    case 'workspace-write':
      if (operation === 'read-file' || operation === 'write-file' || operation === 'execute-command') {
        return { allowed: true, reason: null }
      }
      if (operation === 'delete-file') {
        return { allowed: true, reason: null }
      }
      if (operation === 'access-system') {
        return {
          allowed: false,
          reason: `当前沙箱级别「工作区写入」不允许「系统访问」操作。请切换到「完全访问」级别。`
        }
      }
      return { allowed: true, reason: null }

    case 'full-access':
      return { allowed: true, reason: null }

    default:
      return { allowed: false, reason: `未知沙箱级别: ${level}` }
  }
}

/**
 * Validate that a target path is within a base directory.
 * Prevents path traversal attacks using ../ sequences.
 */
export function validatePath(baseDir: string, targetPath: string): string {
  const resolvedBase = resolve(baseDir)
  const resolvedTarget = resolve(targetPath)

  if (!resolvedTarget.startsWith(resolvedBase + sep) && resolvedTarget !== resolvedBase) {
    throw new Error(`路径验证失败：目标路径 "${targetPath}" 不在基准目录 "${baseDir}" 内`)
  }

  const rel = relative(resolvedBase, resolvedTarget)
  if (rel.startsWith('..') || rel.includes(`..${sep}`)) {
    throw new Error(`路径验证失败：检测到路径遍历 "${targetPath}"`)
  }

  return resolvedTarget
}

/**
 * Check whether a path is allowed under the given sandbox level.
 * In read-only mode, any path is readable.
 * In workspace-write mode, the path must be within the project directory.
 * In full-access mode, any path is allowed.
 */
export function validatePathForLevel(
  level: SandboxLevel,
  projectDir: string,
  targetPath: string,
  operation: 'read' | 'write'
): PermissionResult {
  if (level === 'full-access') {
    return { allowed: true, reason: null }
  }

  if (operation === 'read' && level === 'read-only') {
    return { allowed: true, reason: null }
  }

  try {
    validatePath(projectDir, targetPath)
    return { allowed: true, reason: null }
  } catch {
    return {
      allowed: false,
      reason: `路径验证失败：「${targetPath}」不在项目目录「${projectDir}」内。当前沙箱级别不允许访问外部路径。`
    }
  }
}

/**
 * Validate a command against the sandbox level.
 * - read-only: no commands allowed
 * - workspace-write: only allowed development commands
 * - full-access: all commands allowed (but dangerous ones are flagged)
 */
export function validateCommand(level: SandboxLevel, command: string): PermissionResult {
  if (level === 'read-only') {
    return {
      allowed: false,
      reason: '当前沙箱级别「只读」不允许执行任何命令。'
    }
  }

  const trimmed = command.trim()
  if (!trimmed) {
    return { allowed: false, reason: '空命令' }
  }

  const baseCmd = trimmed.split(/\s+/)[0].toLowerCase()
  const cleanBase = baseCmd.replace(/\.(exe|cmd|bat|ps1|sh)$/, '')

  // Check dangerous commands at all levels
  for (const pattern of DANGEROUS_COMMAND_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        allowed: level === 'full-access',
        reason: `检测到危险命令模式，该操作可能造成不可逆的损害。${level === 'full-access' ? '已在完全访问模式下放行。' : '请切换到「完全访问」级别。'}`
      }
    }
  }

  if (level === 'workspace-write') {
    if (!WORKSPACE_ALLOWED_COMMANDS.includes(cleanBase)) {
      return {
        allowed: false,
        reason: `命令「${baseCmd}」不在工作区允许列表中。允许的命令：${WORKSPACE_ALLOWED_COMMANDS.slice(0, 10).join(', ')} 等。请切换到「完全访问」级别以执行此命令。`
      }
    }
  }

  return { allowed: true, reason: null }
}

function operationLabel(op: OperationType): string {
  const labels: Record<OperationType, string> = {
    'read-file': '读取文件',
    'write-file': '写入文件',
    'execute-command': '执行命令',
    'delete-file': '删除文件',
    'access-system': '系统访问',
  }
  return labels[op] ?? op
}
