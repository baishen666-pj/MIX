import { useState, useCallback, useRef, useEffect } from 'react'
import { useAppStore } from '../stores/app'

interface PersonaTemplate {
  id: string
  name: string
  icon: string
  description: string
  prompt: string
}

const TEMPLATES: PersonaTemplate[] = [
  {
    id: 'default',
    name: '通用助手',
    icon: '🤖',
    description: '友好、专业的全能AI助手',
    prompt: `你是一个友好、专业的AI助手。你的回答应该：
- 清晰、准确、有条理
- 适时使用Markdown格式
- 对不确定的内容坦诚说明
- 优先给出实用建议`
  },
  {
    id: 'reviewer',
    name: '严格审查员',
    icon: '🔍',
    description: '注重质量和安全的代码审查专家',
    prompt: `你是一位严格的代码审查专家。审查时注意：
- 安全漏洞（SQL注入、XSS、CSRF）
- 性能问题（N+1查询、内存泄漏）
- 代码质量（可读性、可维护性）
- 类型安全和错误处理
- 测试覆盖率

评级标准：
- CRITICAL: 安全漏洞，必须修复
- HIGH: Bug或重大质量问题
- MEDIUM: 可维护性问题
- LOW: 风格建议

回答简明扼要，直指问题。`
  },
  {
    id: 'creative',
    name: '创意作家',
    icon: '✍️',
    description: '富有想象力的内容创作伙伴',
    prompt: `你是一位富有创造力的写作伙伴。你的特点：
- 文笔优美，善于运用比喻和修辞
- 能够适应各种写作风格（正式、轻松、幽默）
- 善于构建引人入胜的叙事结构
- 注重细节和情感表达
- 提供多个创意方向供选择

在创作时，先理解用户意图，再展开想象。`
  },
  {
    id: 'debugger',
    name: '调试专家',
    icon: '🐛',
    description: '系统化的问题分析和调试',
    prompt: `你是一位经验丰富的调试专家。方法论：
1. 先理解问题的完整上下文
2. 分析错误信息和调用栈
3. 缩小问题范围（二分法）
4. 提出假设并验证
5. 给出修复方案和预防建议

回答格式：
- 问题分析：一句话定位根因
- 复现路径：最小复现步骤
- 修复方案：具体代码改动
- 预防措施：防止复发

保持冷静和系统化思维。`
  },
  {
    id: 'analyst',
    name: '数据分析师',
    icon: '📊',
    description: '数据驱动的分析和决策支持',
    prompt: `你是一位数据分析师。工作原则：
- 所有结论必须有数据支撑
- 区分相关性和因果性
- 量化分析优于主观判断
- 清晰可视化复杂数据

输出格式：
- 关键发现（3-5条）
- 数据支撑（表格/图表描述）
- 行动建议（优先级排序）
- 风险评估

使用精确的数字和百分比，避免模糊表述。`
  }
]

const MAX_CHARS = 2000

export function SoulEditorPanel() {
  const soulPrompt = useAppStore((s) => s.soulPrompt)
  const setSoulPrompt = useAppStore((s) => s.setSoulPrompt)
  const [prompt, setLocalPrompt] = useState(soulPrompt)
  const [activeTemplate, setActiveTemplate] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const prevSoulRef = useRef(soulPrompt)

  useEffect(() => {
    if (soulPrompt !== prevSoulRef.current) {
      prevSoulRef.current = soulPrompt
      setLocalPrompt(soulPrompt)
    }
  }, [soulPrompt])

  // Load SOUL.md from backend on mount
  useEffect(() => {
    if (!window.mixDesktop) return
    window.mixDesktop.memoryReadSoul().then((content: string) => {
      if (content && !soulPrompt) {
        setLocalPrompt(content)
        setSoulPrompt(content)
      }
    }).catch(() => {})
  }, [setSoulPrompt, soulPrompt])

  const handleApplyTemplate = useCallback((template: PersonaTemplate) => {
    setActiveTemplate(template.id)
    setLocalPrompt(template.prompt)
  }, [])

  const handleSave = useCallback(async () => {
    setSoulPrompt(prompt)
    if (window.mixDesktop) {
      try {
        await window.mixDesktop.memoryWriteSoul(prompt)
      } catch {
        // Silently fail - local state is still updated
      }
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }, [prompt, setSoulPrompt])

  const handleReset = useCallback(async () => {
    setLocalPrompt('')
    setActiveTemplate(null)
    setSoulPrompt('')
    if (window.mixDesktop) {
      try {
        await window.mixDesktop.memoryResetSoul()
      } catch {
        // Silently fail
      }
    }
  }, [setSoulPrompt])

  const charCount = prompt.length
  const charPercent = (charCount / MAX_CHARS) * 100

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-border-subtle px-4 py-2">
        <h2 className="text-sm font-medium text-content-heading">角色编辑器</h2>
        <div className="flex items-center gap-3">
          <span className="text-xs text-content-subtle">定义 AI 的性格和行为方式</span>
          {prompt && (
            <button
              onClick={handleReset}
              className="rounded px-2 py-1 text-xs text-content-subtle hover:bg-surface-overlay hover:text-danger"
            >
              重置
            </button>
          )}
          <button
            onClick={handleSave}
            className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
              saved
                ? 'bg-success text-white'
                : 'bg-accent text-white hover:bg-accent-hover'
            }`}
          >
            {saved ? '已保存' : '保存'}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Template sidebar */}
        <div className="w-52 shrink-0 overflow-y-auto border-r border-border-subtle bg-surface-base p-3">
          <div className="mb-3 text-xs font-medium uppercase tracking-wider text-content-subtle">
            角色模板
          </div>
          <div className="flex flex-col gap-1.5">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                onClick={() => handleApplyTemplate(t)}
                className={`flex items-start gap-2.5 rounded-lg px-3 py-2.5 text-left transition-colors ${
                  activeTemplate === t.id
                    ? 'bg-accent/15 border border-accent/30'
                    : 'border border-transparent hover:bg-surface-elevated'
                }`}
              >
                <span className="mt-0.5 text-base">{t.icon}</span>
                <div className="min-w-0">
                  <div className="text-xs font-medium text-content-heading">{t.name}</div>
                  <div className="mt-0.5 text-[10px] leading-tight text-content-subtle">{t.description}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Editor area */}
        <div className="flex flex-1 flex-col overflow-hidden p-4">
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium text-content-muted">系统提示词</div>
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-24 rounded-full bg-surface-overlay">
                <div
                  className={`h-full rounded-full transition-all ${
                    charPercent > 90 ? 'bg-danger' : charPercent > 70 ? 'bg-warning' : 'bg-accent-hover'
                  }`}
                  style={{ width: `${Math.min(charPercent, 100)}%` }}
                />
              </div>
              <span className={`text-[10px] ${charCount > MAX_CHARS ? 'text-danger' : 'text-content-subtle'}`}>
                {charCount}/{MAX_CHARS}
              </span>
            </div>
          </div>

          <textarea
            value={prompt}
            onChange={(e) => { setLocalPrompt(e.target.value.slice(0, MAX_CHARS)); setActiveTemplate(null) }}
            className="mt-2 flex-1 resize-none rounded-lg border border-border-subtle bg-surface-elevated p-4 font-mono text-sm leading-relaxed text-content-heading outline-none transition-colors focus:border-accent/50"
            spellCheck={false}
          />

          {/* Preview */}
          <div className="mt-3 rounded-lg border border-border-subtle bg-surface-elevated/50 p-3">
            <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-content-subtle">
              预览
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/20 text-sm">
                {TEMPLATES.find((t) => t.id === activeTemplate)?.icon ?? '🤖'}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-medium text-content-heading">
                  {TEMPLATES.find((t) => t.id === activeTemplate)?.name ?? '自定义'}
                </div>
                <div className="mt-0.5 line-clamp-2 text-[10px] leading-relaxed text-content-subtle">
                  {prompt.slice(0, 120)}{prompt.length > 120 ? '...' : ''}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
