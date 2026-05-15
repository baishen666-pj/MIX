import { useState, useCallback, Suspense, lazy, memo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { EnhancedDiffViewer } from './ToolCallCard'

const SyntaxHighlighter = lazy(() =>
  import('react-syntax-highlighter/dist/esm/prism-light').then(async (m) => {
    const languages = [
      'typescript', 'javascript', 'python', 'bash', 'json', 'css', 'markdown',
      'html', 'sql', 'yaml', 'rust', 'go', 'java', 'c', 'cpp', 'shell'
    ]
    for (const lang of languages) {
      try {
        const mod = await import(/* @vite-ignore */ `react-syntax-highlighter/dist/esm/languages/prism/${lang}`)
        m.registerLanguage(lang, mod.default)
      } catch { /* skip unavailable */ }
    }
    return { default: m.default || m }
  })
)

interface CodeBlockProps {
  language: string
  children: string
}

const RUNNABLE_LANGS = new Set(['javascript', 'js', 'typescript', 'ts', 'python', 'py', 'bash', 'sh', 'shell'])

function CodeBlock({ language, children }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)
  const [running, setRunning] = useState(false)
  const [output, setOutput] = useState<string | null>(null)

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(children).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [children])

  const handleRun = useCallback(async () => {
    const lang = language.toLowerCase()
    setRunning(true)
    setOutput(null)

    if (lang === 'python' || lang === 'py') {
      if (window.mixDesktop) {
        window.mixDesktop.chatSend({
          messages: [
            { role: 'system', content: '执行以下 Python 代码，只返回输出结果。如有错误，返回以"错误:"开头的错误信息。' },
            { role: 'user', content: `\`\`\`python\n${children}\n\`\`\`` }
          ]
        }).catch(() => { setRunning(false); setOutput('错误: 请求失败') })
        let buf = ''
        let cleaned = false
        const cleanup = () => { if (cleaned) return; cleaned = true; unsubChunk(); unsubDone(); unsubErr(); setRunning(false) }
        const unsubChunk = window.mixDesktop.onChatChunk((chunk: string) => { if (!cleaned) { buf += chunk; setOutput(buf) } })
        const unsubDone = window.mixDesktop.onChatDone(cleanup)
        const unsubErr = window.mixDesktop.onChatError((msg: string) => { if (!cleaned) { setOutput(`错误: ${msg}`) } cleanup() })
      }
      return
    }

    // JS/TS/Bash — execute locally via eval (sandboxed) or shell
    if (lang === 'bash' || lang === 'sh' || lang === 'shell') {
      if (window.mixDesktop?.runShell) {
        window.mixDesktop.runShell(children).then((result: string) => { setOutput(result); setRunning(false) }).catch((e: Error) => { setOutput(`错误: ${e.message}`); setRunning(false) })
      } else {
        setOutput('Shell 执行仅在桌面端可用')
        setRunning(false)
      }
      return
    }

    // JS/TS — route through IPC shell for safety (no eval in renderer)
    try {
      const result = await window.mixDesktop.runShell(`node -e "${children.replace(/"/g, '\\"').replace(/`/g, '\\`')}"`)
      setOutput(result || '（无输出）')
    } catch (e) {
      setOutput(`错误: ${(e as Error).message}`)
    }
    setRunning(false)
  }, [language, children])

  const isDiff = language === 'diff'
  const canRun = RUNNABLE_LANGS.has(language.toLowerCase())

  if (isDiff) {
    return (
      <div className="group relative">
        <div className="absolute right-1 top-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
          <CopyButton copied={copied} onClick={handleCopy} />
        </div>
        <EnhancedDiffViewer content={children} />
      </div>
    )
  }

  return (
    <div className="group relative my-2 overflow-hidden rounded-lg border border-border-default">
      <div className="flex items-center justify-between bg-surface-overlay px-3 py-1 text-xs text-content-muted">
        <span>{language || '代码'}</span>
        <div className="flex items-center gap-1">
          {canRun && (
            <button
              onClick={handleRun}
              disabled={running}
              className="flex items-center gap-1 rounded px-2 py-0.5 text-xs text-success transition-colors hover:bg-success/10 disabled:opacity-40"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21"/></svg>
              {running ? '运行中...' : '运行'}
            </button>
          )}
          <CopyButton copied={copied} onClick={handleCopy} />
        </div>
      </div>
      <Suspense
        fallback={
          <pre className="bg-surface-elevated p-3 text-sm text-content-heading">{children}</pre>
        }
      >
        <SyntaxHighlighter
          language={language || 'typescript'}
          useInlineStyles={false}
          wrapLongLines
          className="!bg-surface-elevated !p-3 !text-sm"
        >
          {children}
        </SyntaxHighlighter>
      </Suspense>
      {output !== null && (
        <div className="border-t border-border-subtle bg-surface-base px-3 py-2">
          <div className="mb-1 text-[10px] font-medium text-content-subtle">输出</div>
          <pre className="overflow-x-auto text-xs text-content-secondary whitespace-pre-wrap">{output}</pre>
        </div>
      )}
    </div>
  )
}

function CopyButton({ copied, onClick }: { copied: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 rounded px-2 py-0.5 text-xs text-content-subtle transition-colors hover:bg-surface-inset hover:text-content-heading"
    >
      {copied ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
      )}
      {copied ? '已复制' : '复制'}
    </button>
  )
}

interface AgentMarkdownProps {
  content: string
}

const markdownComponents = {
  code(props: React.ClassAttributes<HTMLElement> & React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }) {
    const { className, children, ...rest } = props
    const match = /language-(\w+)/.exec(className || '')
    const isInline = !match && !className
    if (isInline) {
      return <code className={className} {...rest}>{children}</code>
    }
    return (
      <CodeBlock language={match?.[1] || ''}>
        {String(children).replace(/\n$/, '')}
      </CodeBlock>
    )
  },
  a(props: React.AnchorHTMLAttributes<HTMLAnchorElement> & { children?: React.ReactNode }) {
    const { href, children } = props
    return (
      <a
        href={href}
        onClick={(e) => {
          e.preventDefault()
          if (href && (href.startsWith('http') || href.startsWith('mailto'))) {
            window.mixDesktop?.openExternal(href)
          }
        }}
        className="cursor-pointer"
      >
        {children}
      </a>
    )
  }
}

export const AgentMarkdown = memo(function AgentMarkdown({ content }: AgentMarkdownProps) {
  return (
    <div className="prose-invert max-w-none text-sm text-content-secondary [&_a]:text-accent-text [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-border-default [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-content-muted [&_code]:rounded [&_code]:bg-surface-overlay [&_code]:px-1 [&_code]:text-accent-text [&_h1]:mt-4 [&_h1]:text-lg [&_h1]:font-bold [&_h2]:mt-3 [&_h2]:text-base [&_h2]:font-bold [&_h3]:mt-2 [&_h3]:font-bold [&_hr]:border-border-default [&_li]:ml-4 [&_ol]:list-decimal [&_p]:my-1 [&_strong]:text-content-primary [&_table]:my-2 [&_td]:border [&_td]:border-border-default [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-border-default [&_th]:bg-surface-overlay [&_th]:px-2 [&_th]:py-1 [&_th]:font-medium [&_ul]:list-disc">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={markdownComponents}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
})
