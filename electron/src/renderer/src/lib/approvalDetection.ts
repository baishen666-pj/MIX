export type DangerCategory =
  | 'file_delete'
  | 'shell_exec'
  | 'db_destructive'
  | 'system_modify'
  | 'deploy_publish'
  | 'env_secret'
  | 'mass_change'

export interface DetectionResult {
  detected: boolean
  category: DangerCategory | null
  summary: string
  confidence: 'high' | 'medium'
  matchedPattern: string | null
}

interface DangerPattern {
  category: DangerCategory
  pattern: RegExp
  summary: string
  confidence: 'high' | 'medium'
}

const DANGER_PATTERNS: DangerPattern[] = [
  // File deletion
  { category: 'file_delete', pattern: /\brm\s+(-[a-zA-Z]*f[a-zA-Z]*\s+|--force\s+)\S+/i, summary: '强制删除文件', confidence: 'high' },
  { category: 'file_delete', pattern: /\brm\s+-r[a-zA-Z]*\s+[^\s|>;]+/i, summary: '递归删除文件/目录', confidence: 'high' },
  { category: 'file_delete', pattern: /\b(delete|remove|unlink)\s+(file|dir|directory|folder)\b/i, summary: '删除文件或目录', confidence: 'high' },
  { category: 'file_delete', pattern: /\bfs\.(unlink|rmdir|rm)\s*\(/i, summary: '程序化删除文件', confidence: 'medium' },
  { category: 'file_delete', pattern: /\bos\.remove\(/i, summary: '操作系统级删除', confidence: 'high' },
  { category: 'file_delete', pattern: /\bDROP\s+(TABLE|DATABASE|SCHEMA)/i, summary: '删除数据库表或库', confidence: 'high' },

  // Shell command execution
  { category: 'shell_exec', pattern: /\bexec\s*\(\s*['"`]/i, summary: '执行系统命令', confidence: 'high' },
  { category: 'shell_exec', pattern: /\bspawn\s*\(/i, summary: '生成子进程执行命令', confidence: 'high' },
  { category: 'shell_exec', pattern: /\bchild_process/i, summary: '使用子进程模块', confidence: 'medium' },
  { category: 'shell_exec', pattern: /\bsubprocess\.(run|call|Popen)/i, summary: 'Python 子进程调用', confidence: 'medium' },
  { category: 'shell_exec', pattern: /\bos\.system\s*\(/i, summary: '系统命令调用', confidence: 'high' },
  { category: 'shell_exec', pattern: /\beval\s*\(/i, summary: '动态代码执行', confidence: 'high' },

  // Database destructive operations
  { category: 'db_destructive', pattern: /\bTRUNCATE\s+/i, summary: '清空数据表', confidence: 'high' },
  { category: 'db_destructive', pattern: /\bDELETE\s+FROM\s+\w+\s*;/i, summary: '无条件删除数据', confidence: 'high' },
  { category: 'db_destructive', pattern: /\bALTER\s+TABLE\s+\w+\s+DROP/i, summary: '删除表列', confidence: 'medium' },
  { category: 'db_destructive', pattern: /\bmigrate\s*(:|\.)?\s*(down|reset|rollback)/i, summary: '数据库回滚操作', confidence: 'medium' },

  // System modifications
  { category: 'system_modify', pattern: /\b(npm|yarn|pnpm)\s+(uninstall|remove)\s+/i, summary: '卸载依赖包', confidence: 'medium' },
  { category: 'system_modify', pattern: /\bpip\s+uninstall\s+/i, summary: '卸载 Python 包', confidence: 'medium' },
  { category: 'system_modify', pattern: /\bapt(-get)?\s+(remove|purge)\s+/i, summary: '卸载系统包', confidence: 'high' },
  { category: 'system_modify', pattern: /\bsystemctl\s+(stop|disable|restart)\s+/i, summary: '停止系统服务', confidence: 'high' },
  { category: 'system_modify', pattern: /\bdocker\s+(rm|rmi|stop|kill)\s+/i, summary: 'Docker 容器/镜像操作', confidence: 'medium' },
  { category: 'system_modify', pattern: /\bkill\s+(-9\s+)?\d+/i, summary: '强制终止进程', confidence: 'high' },

  // Deploy / publish
  { category: 'deploy_publish', pattern: /\bgit\s+push\s+(-f|--force)/i, summary: '强制推送到远程仓库', confidence: 'high' },
  { category: 'deploy_publish', pattern: /\bgit\s+reset\s+--hard/i, summary: '硬重置 Git 历史', confidence: 'high' },
  { category: 'deploy_publish', pattern: /\b(npm|yarn)\s+publish\s+/i, summary: '发布包到 registry', confidence: 'medium' },
  { category: 'deploy_publish', pattern: /\bdeploy\s+/i, summary: '部署操作', confidence: 'medium' },
  { category: 'deploy_publish', pattern: /\bkubectl\s+(delete|apply)\s+/i, summary: 'Kubernetes 集群操作', confidence: 'high' },

  // Environment / secrets
  { category: 'env_secret', pattern: /\b\.env\b.*\b(write|modify|update|change)/i, summary: '修改环境变量文件', confidence: 'medium' },
  { category: 'env_secret', pattern: /\b(api[_-]?key|secret|password|token|credential)\s*=\s*['"][^'"]+/i, summary: '写入密钥/凭据', confidence: 'high' },
  { category: 'env_secret', pattern: /\bprocess\.env\.\w+\s*=/i, summary: '修改运行时环境变量', confidence: 'medium' },

  // Mass code changes
  { category: 'mass_change', pattern: /\b(refactor|rewrite|replace)\s+(all|entire|whole|every)\b/i, summary: '大规模代码重构', confidence: 'medium' },
  { category: 'mass_change', pattern: /\bdelete\s+(all|every|entire|whole)\b.*\bfile/i, summary: '批量删除文件', confidence: 'high' },
]

export function detectDangerousContent(text: string): DetectionResult {
  if (!text || text.length < 10) {
    return { detected: false, category: null, summary: '', confidence: 'medium', matchedPattern: null }
  }

  const highResults: DetectionResult[] = []
  const mediumResults: DetectionResult[] = []

  for (const rule of DANGER_PATTERNS) {
    const match = text.match(rule.pattern)
    if (match) {
      const result: DetectionResult = {
        detected: true,
        category: rule.category,
        summary: rule.summary,
        confidence: rule.confidence,
        matchedPattern: match[0]
      }
      if (rule.confidence === 'high') {
        highResults.push(result)
      } else {
        mediumResults.push(result)
      }
    }
  }

  if (highResults.length > 0) return highResults[0]
  if (mediumResults.length > 0) return mediumResults[0]
  return { detected: false, category: null, summary: '', confidence: 'medium', matchedPattern: null }
}

export const CATEGORY_LABELS: Record<DangerCategory, string> = {
  file_delete: '文件删除',
  shell_exec: '命令执行',
  db_destructive: '数据库操作',
  system_modify: '系统修改',
  deploy_publish: '部署发布',
  env_secret: '密钥/环境变量',
  mass_change: '批量变更'
}
