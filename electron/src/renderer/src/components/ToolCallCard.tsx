import { useState, useMemo } from 'react'

interface DiffStats {
  added: number
  removed: number
  unchanged: number
  fileName: string | null
}

function parseDiffStats(content: string): DiffStats {
  const lines = content.split('\n')
  let added = 0
  let removed = 0
  let unchanged = 0
  let fileName: string | null = null

  for (const line of lines) {
    if (line.startsWith('+++ ') || line.startsWith('--- ')) {
      if (!fileName) {
        const match = line.match(/^[+-]{3}\s+(?:a\/)?(.+)$/)
        if (match) fileName = match[1]
      }
      continue
    }
    if (line.startsWith('@@')) continue
    if (line.startsWith('+')) added++
    else if (line.startsWith('-')) removed++
    else unchanged++
  }

  // Try to extract filename from diff header
  if (!fileName) {
    const match = content.match(/diff --git a\/(.+?) b\//)
    if (match) fileName = match[1]
  }

  return { added, removed, unchanged, fileName }
}

interface EnhancedDiffViewerProps {
  content: string
}

export function EnhancedDiffViewer({ content }: EnhancedDiffViewerProps) {
  const [expanded, setExpanded] = useState(true)
  const stats = useMemo(() => parseDiffStats(content), [content])

  const lines = content.split('\n')
  const filteredLines = lines.filter((l) => !l.startsWith('diff --git') && !l.startsWith('index ') && !l.startsWith('+++ ') && !l.startsWith('--- '))

  let lineNum = 0

  return (
    <div className="group my-2 overflow-hidden rounded-lg border border-border-default">
      {/* Header with stats */}
      <div
        className="flex items-center gap-2 bg-surface-overlay px-3 py-1.5 cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <svg
          width="10" height="10" viewBox="0 0 24 24" fill="currentColor"
          className={`text-content-subtle transition-transform ${expanded ? 'rotate-90' : ''}`}
        >
          <polygon points="8 4 20 12 8 20" />
        </svg>

        {stats.fileName && (
          <span className="text-xs font-medium text-accent-text">{stats.fileName}</span>
        )}

        <div className="flex items-center gap-2 ml-auto">
          <span className="flex items-center gap-1 text-[10px]">
            <span className="text-success">+{stats.added}</span>
            <span className="text-danger">-{stats.removed}</span>
          </span>
          <span className="rounded bg-surface-inset px-1.5 py-0.5 text-[10px] text-content-subtle">差异</span>
        </div>
      </div>

      {/* Diff content */}
      {expanded && (
        <div className="overflow-x-auto bg-surface-elevated text-sm max-h-80 overflow-y-auto">
          <table className="w-full border-collapse">
            <tbody>
              {filteredLines.map((line, i) => {
                if (line.startsWith('@@')) {
                  return (
                    <tr key={i} className="bg-accent/5">
                      <td colSpan={3} className="px-3 py-0.5 text-[10px] text-accent-text font-mono whitespace-nowrap">
                        {line}
                      </td>
                    </tr>
                  )
                }

                lineNum++
                const isAdd = line.startsWith('+')
                const isRemove = line.startsWith('-')
                const bgColor = isAdd ? 'bg-success/8' : isRemove ? 'bg-danger/8' : ''
                const textColor = isAdd ? 'text-success' : isRemove ? 'text-danger' : 'text-content-heading'
                const lineType = isAdd ? '+' : isRemove ? '-' : ' '

                return (
                  <tr key={i} className={`${bgColor} hover:bg-surface-overlay/50`}>
                    <td className="w-8 select-none border-r border-border-subtle px-1.5 py-0 text-right font-mono text-[10px] text-content-subtle">
                      {!isAdd && !isRemove ? lineNum : ''}
                    </td>
                    <td className="w-4 select-none px-0 py-0 text-center font-mono text-[10px] text-content-subtle">
                      {lineType}
                    </td>
                    <td className={`px-2 py-0 font-mono whitespace-pre ${textColor}`}>
                      {line.slice(1)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// Tool result card for structured display
type ToolType = 'file_edit' | 'command' | 'api_response' | 'analysis' | 'generic'

interface ToolResultCardProps {
  content: string
}

function detectToolType(content: string): ToolType {
  if (/^(Creating|Editing|Modifying|Updating|Writing)\s+\S+\n/i.test(content)) return 'file_edit'
  if (/^\$\s|^>\s|^Running|^Executing/i.test(content)) return 'command'
  if (/^(Status|Response|GET|POST|PUT|DELETE)\s/i.test(content)) return 'api_response'
  if (/^(Analysis|Summary|Review|Finding)/i.test(content)) return 'analysis'
  return 'generic'
}

const TOOL_ICONS: Record<ToolType, { icon: string; color: string }> = {
  file_edit: { icon: '📄', color: 'text-accent-text' },
  command: { icon: '⌨', color: 'text-success' },
  api_response: { icon: '🌐', color: 'text-warning' },
  analysis: { icon: '🔍', color: 'text-accent-text' },
  generic: { icon: '🔧', color: 'text-content-muted' }
}

export function ToolResultCard({ content }: ToolResultCardProps) {
  const [expanded, setExpanded] = useState(false)
  const toolType = useMemo(() => detectToolType(content), [content])
  const { icon, color } = TOOL_ICONS[toolType]
  const preview = content.split('\n')[0]
  const lineCount = content.split('\n').length

  return (
    <div className="my-2 overflow-hidden rounded-lg border border-border-default bg-surface-elevated">
      <div
        className="flex items-center gap-2 px-3 py-1.5 cursor-pointer select-none hover:bg-surface-overlay/50"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="text-xs">{icon}</span>
        <span className={`text-xs font-medium ${color}`}>{preview}</span>
        {lineCount > 1 && (
          <span className="ml-auto text-[10px] text-content-subtle">
            {lineCount} 行 {expanded ? '▲' : '▼'}
          </span>
        )}
      </div>
      {expanded && lineCount > 1 && (
        <div className="border-t border-border-subtle bg-surface-base px-3 py-2">
          <pre className="overflow-x-auto text-xs text-content-secondary whitespace-pre-wrap">{content}</pre>
        </div>
      )}
    </div>
  )
}

// Thinking/analysis collapsible block
export function ThinkingBlock({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="my-2 overflow-hidden rounded-lg border border-accent/20 bg-accent/5">
      <div
        className="flex items-center gap-2 px-3 py-1.5 cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent-text">
          <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
        </svg>
        <span className="text-xs font-medium text-accent-text">思考过程</span>
        <span className="ml-auto text-[10px] text-content-subtle">{expanded ? '收起' : '展开'}</span>
      </div>
      {expanded && (
        <div className="border-t border-accent/10 px-3 py-2">
          <div className="text-xs text-content-muted whitespace-pre-wrap leading-relaxed">{content}</div>
        </div>
      )}
    </div>
  )
}
