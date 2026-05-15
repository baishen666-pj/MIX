export function ChatEmptyState() {
  const suggestions = [
    { text: '帮我分析这段代码', icon: '>' },
    { text: '描述一下这张图片', icon: '~' },
    { text: '/canvas', icon: '#' },
  ]
  return (
    <div className="flex h-full items-center justify-center text-content-subtle">
      <div className="text-center">
        <div className="mb-3 text-4xl">🕸️</div>
        <p className="text-sm font-medium text-content-muted">多Agent桌面工作台</p>
        <p className="mt-2 text-xs text-content-subtle">输入消息、粘贴/上传图片开始对话</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {suggestions.map((s) => (
            <span key={s.text} className="rounded-full border border-border-subtle bg-surface-elevated px-3 py-1 text-xs text-content-subtle">
              {s.text}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
