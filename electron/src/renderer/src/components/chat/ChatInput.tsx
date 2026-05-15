import { SlashCommandMenu } from '../SlashCommandMenu'
import type { SlashCommand } from '../SlashCommandMenu'

interface ChatInputProps {
  input: string
  onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  isLoading: boolean
  pendingImage: string | null
  onSend: () => void
  onKeyDown: (e: React.KeyboardEvent) => void
  onPaste: (e: React.ClipboardEvent) => void
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  onRemovePendingImage: () => void
  slashMenuOpen: boolean
  slashFilter: string
  menuPos: { top: number; left: number }
  onSlashCommand: (cmd: SlashCommand) => void
  onSlashMenuClose: () => void
  inputRef: React.RefObject<HTMLTextAreaElement | null>
  fileInputRef: React.RefObject<HTMLInputElement | null>
}

export function ChatInput({
  input,
  onInputChange,
  isLoading,
  pendingImage,
  onSend,
  onKeyDown,
  onPaste,
  onImageUpload,
  onRemovePendingImage,
  slashMenuOpen,
  slashFilter,
  menuPos,
  onSlashCommand,
  onSlashMenuClose,
  inputRef,
  fileInputRef,
}: ChatInputProps) {
  return (
    <div className="relative border-t border-border-subtle p-3">
      {pendingImage && (
        <div className="mb-2 flex items-center gap-2">
          <img src={pendingImage} alt="待发送" className="h-16 w-16 rounded-lg border border-border-default object-cover" />
          <button onClick={onRemovePendingImage} className="rounded bg-surface-overlay px-2 py-1 text-xs text-content-subtle hover:text-content-heading">移除</button>
        </div>
      )}
      {slashMenuOpen && (
        <SlashCommandMenu filter={slashFilter} onSelect={onSlashCommand} onClose={onSlashMenuClose} position={menuPos} />
      )}
      <div className="flex gap-2">
        <input ref={fileInputRef} type="file" accept="image/*" onChange={onImageUpload} className="hidden" />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="shrink-0 rounded-lg border border-border-default bg-surface-elevated px-2 py-2 text-sm text-content-subtle hover:bg-surface-overlay hover:text-content-heading"
          title="上传图片"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
        </button>
        <textarea
          ref={inputRef}
          value={input}
          onChange={onInputChange}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          placeholder={pendingImage ? '添加图片描述...' : '输入消息，/ 查看命令...'}
          rows={1}
          className="auto-resize flex-1 rounded-lg border border-border-default bg-surface-elevated px-3 py-2 text-sm text-content-secondary placeholder-content-subtle outline-none transition-colors focus:border-accent"
        />
        <button
          onClick={onSend}
          disabled={isLoading || (!input.trim() && !pendingImage) || input.startsWith('/')}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-40"
        >
          发送
        </button>
      </div>
    </div>
  )
}
