import { useState, useEffect, lazy, Suspense } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { useAppStore } from './stores/app'
import { useChatStore } from './stores/chatStore'
import { setProfileSwitchHandler } from './stores/profileStore'
import type { ViewMode } from '../../shared/types'
import { Sidebar } from './components/Sidebar'
import { ChatPanel } from './components/ChatPanel'
import { SessionSidebar } from './components/SessionSidebar'
import { MemoryPanel } from './components/MemoryPanel'
import { ToolsPanel } from './components/ToolsPanel'
import { SettingsPanel } from './components/SettingsPanel'
import { CheckpointPanel } from './components/CheckpointPanel'
import { ComputerUsePanel } from './components/computer-use/ComputerUsePanel'
import { ImPanel } from './components/im/ImPanel'
import { ShortcutHelp } from './components/ShortcutHelp'
import { ApprovalPanel } from './components/ApprovalPanel'
import { UpdateNotification } from './components/UpdateNotification'
import { usePersistence } from './hooks/usePersistence'

const AgentCanvas = lazy(() => import('./components/canvas/AgentCanvas').then((m) => ({ default: m.AgentCanvas })))
const AgentGraph3D = lazy(() => import('./components/three/AgentGraph3D').then((m) => ({ default: m.AgentGraph3D })))
const SoulEditorPanel = lazy(() => import('./components/SoulEditorPanel').then((m) => ({ default: m.SoulEditorPanel })))
const SchedulePanel = lazy(() => import('./components/SchedulePanel').then((m) => ({ default: m.SchedulePanel })))
const WorkflowEditor = lazy(() => import('./components/workflow/WorkflowEditor').then((m) => ({ default: m.WorkflowEditor })))

const VIEW_KEYS: Record<number, ViewMode> = {
  1: 'chat',
  2: 'canvas',
  3: '3d',
  4: 'memory',
  5: 'tools',
  6: 'schedule',
  7: 'workflow',
  8: 'soul',
  9: 'settings'
}

export function App() {
  const view = useAppStore((s) => s.view)
  const setView = useAppStore((s) => s.setView)
  const clearMessages = useAppStore((s) => s.clearMessages)
  const theme = useAppStore((s) => s.theme)
  const [showHelp, setShowHelp] = useState(false)
  usePersistence()

  useEffect(() => {
    setProfileSwitchHandler(() => useChatStore.getState().clearMessages())
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        const num = parseInt(e.key)
        if (num >= 1 && num <= 9 && VIEW_KEYS[num]) {
          e.preventDefault()
          setView(VIEW_KEYS[num])
        }
        if (e.key === 'n') {
          e.preventDefault()
          clearMessages()
        }
        if (e.key === '/') {
          e.preventDefault()
          setShowHelp((v) => !v)
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setView, clearMessages])

  return (
    <div className="flex h-screen min-w-[640px] flex-col bg-surface-base text-content-primary">
      <UpdateNotification />
      <div className="flex flex-1 overflow-hidden">
      <Sidebar activeView={view} onViewChange={setView} />
      <main className="flex-1 overflow-hidden" key={view}>
        <Suspense fallback={<LoadingSpinner />}>
          <div className="animate-view-in h-full">
          {view === 'chat' && <ChatView />}
          {view === 'canvas' && (
            <ReactFlowProvider>
              <AgentCanvas />
            </ReactFlowProvider>
          )}
          {view === '3d' && <AgentGraph3D />}
          {view === 'memory' && <MemoryPanel />}
          {view === 'tools' && <ToolsPanel />}
          {view === 'schedule' && <SchedulePanel />}
          {view === 'workflow' && (
            <ReactFlowProvider>
              <WorkflowEditor />
            </ReactFlowProvider>
          )}
          {view === 'soul' && <SoulEditorPanel />}
          {view === 'checkpoint' && <CheckpointPanel />}
          {view === 'computer-use' && <ComputerUsePanel />}
          {view === 'im' && <ImPanel />}
          {view === 'settings' && <SettingsPanel />}
          </div>
        </Suspense>
      </main>
      {showHelp && <ShortcutHelp onClose={() => setShowHelp(false)} />}
      <ApprovalPanel />
      </div>
    </div>
  )
}

function ChatView() {
  const sessionId = useAppStore((s) => s.sessionId)
  const setSessionId = useAppStore((s) => s.setSessionId)
  const clearMessages = useAppStore((s) => s.clearMessages)

  const handleNewChat = () => {
    clearMessages()
  }

  const handleSelectSession = async (id: string) => {
    if (!window.mixDesktop) return
    try {
      const msgs = await window.mixDesktop.sessionsGetMessages(id) as { id: string; role: string; content: string; timestamp: number }[]
      clearMessages()
      setSessionId(id)
      for (const m of msgs) {
        useAppStore.getState().addMessage({
          id: m.id,
          role: m.role as 'user' | 'agent' | 'system' | 'error',
          content: m.content,
          timestamp: m.timestamp
        })
      }
    } catch {
      // session not found
    }
  }

  return (
    <div className="flex h-full">
      <div className="hidden lg:block">
        <SessionSidebar
          activeSessionId={sessionId}
          onSelectSession={handleSelectSession}
          onNewChat={handleNewChat}
        />
      </div>
      <div className="flex-1 bg-surface-base">
        <ChatPanel />
      </div>
    </div>
  )
}

function LoadingSpinner() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex flex-col items-center gap-2">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        <span className="text-xs text-content-subtle">加载中...</span>
      </div>
    </div>
  )
}
