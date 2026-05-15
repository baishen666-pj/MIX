import type { ChatMessage } from '../../../../shared/types'
import { MessageBubble, ReasoningBlock } from '../MessageBubble'

interface ChatMessagesProps {
  messages: ChatMessage[]
  isLoading: boolean
  toolProgress: string | null
  reasoningContent: string
  onDeleteMessage: (id: string) => void
  bottomRef: React.RefObject<HTMLDivElement | null>
}

export function ChatMessages({
  messages,
  isLoading,
  toolProgress,
  reasoningContent,
  onDeleteMessage,
  bottomRef,
}: ChatMessagesProps) {
  return (
    <div className="flex-1 overflow-y-auto px-4 py-3">
      {messages.map((msg) => (
        <MessageBubble
          key={msg.id}
          msg={msg}
          onDelete={onDeleteMessage}
          onCopy={(c) => navigator.clipboard.writeText(c)}
        />
      ))}
      {isLoading && reasoningContent && <ReasoningBlock content={reasoningContent} />}
      {isLoading && (
        <div className="mb-3 animate-msg-in">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-overlay text-accent-text">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/><line x1="9" y1="19" x2="15" y2="19"/></svg>
            </div>
            <div className="rounded-lg bg-surface-overlay px-3 py-2 text-sm text-content-muted">
              {toolProgress ? (
                <span>{toolProgress}...</span>
              ) : (
                <span className="inline-flex items-center gap-1">
                  {reasoningContent ? '生成中' : '思考中'}
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                </span>
              )}
            </div>
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  )
}
