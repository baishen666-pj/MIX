import { useThemeStore } from './themeStore'
import { useScheduleStore } from './scheduleStore'
import { useWorkflowStore } from './workflowStore'
import { useOfficeStore } from './officeStore'
import { useChatStore } from './chatStore'
import type { TabState } from './chatStore'
import { useProfileStore } from './profileStore'

export type { ThemeMode } from './themeStore'
export type { ChatApprovalRequest, TabState } from './chatStore'
export type { TeamRole, TeamMember, ProjectRoom, ApprovalRequest } from './officeStore'
export type { CanvasAgent, Profile } from './profileStore'

import type { ThemeMode } from './themeStore'
import type { ChatApprovalRequest } from './chatStore'
import type { TeamRole, TeamMember, ProjectRoom, ApprovalRequest } from './officeStore'
import type { CanvasAgent, Profile } from './profileStore'
import type { ChatMessage, ViewMode, ScheduleTask, Workflow, WorkflowNode, WorkflowEdge, WorkflowExecution, NodeExecutionStatus, ToolCall, ToolResult } from '../../../shared/types'
import type { LayoutItem } from '../components/three/types'

export interface AppState {
  theme: ThemeMode
  view: ViewMode
  canvasAgents: CanvasAgent[]
  officeLayout: LayoutItem[]
  soulPrompt: string
  profiles: Profile[]
  activeProfileId: string
  scheduledTasks: ScheduleTask[]
  workflows: Workflow[]
  activeWorkflowId: string | null
  workflowExecution: WorkflowExecution | null
  isAiConfigMode: boolean
  projectRooms: ProjectRoom[]
  approvalRequests: ApprovalRequest[]

  // Tab-based chat state (new API)
  tabs: TabState[]
  activeTabId: string | null

  // Tab management actions
  openTab: (sessionId?: string, title?: string) => string
  closeTab: (sessionId: string) => void
  switchTab: (sessionId: string) => void

  // Backward-compatible flat fields derived from active tab
  messages: ChatMessage[]
  isLoading: boolean
  toolProgress: string | null
  sessionId: string | null
  reasoningContent: string
  chatApproval: ChatApprovalRequest | null
  activeToolCalls: ToolCall[]
  toolResults: ToolResult[]

  // Actions
  setView: (view: ViewMode) => void
  addMessage: (msg: ChatMessage) => void
  appendToLastAgent: (chunk: string) => void
  setLoading: (loading: boolean) => void
  setSessionId: (id: string | null) => void
  setToolProgress: (tool: string | null) => void
  setCanvasAgents: (agents: CanvasAgent[]) => void
  setOfficeLayout: (items: LayoutItem[]) => void
  setSoulPrompt: (prompt: string) => void
  appendReasoning: (text: string) => void
  clearReasoning: () => void
  clearMessages: () => void
  switchProfile: (id: string) => void
  createProfile: (name: string) => void
  deleteProfile: (id: string) => void
  renameProfile: (id: string, name: string) => void
  addScheduledTask: (task: ScheduleTask) => void
  updateScheduledTask: (id: string, patch: Partial<ScheduleTask>) => void
  deleteScheduledTask: (id: string) => void
  tickScheduledTask: (id: string) => void
  createWorkflow: (name: string) => string
  updateWorkflow: (id: string, patch: Partial<Workflow>) => void
  deleteWorkflow: (id: string) => void
  setActiveWorkflow: (id: string | null) => void
  updateWorkflowNodes: (id: string, nodes: WorkflowNode[]) => void
  updateWorkflowEdges: (id: string, edges: WorkflowEdge[]) => void
  startWorkflowExecution: (workflowId: string) => void
  updateNodeExecution: (nodeId: string, status: NodeExecutionStatus, output?: string) => void
  completeWorkflowExecution: (status: 'completed' | 'failed') => void
  setTheme: (theme: ThemeMode) => void
  setAiConfigMode: (mode: boolean) => void
  addProjectRoom: (name: string) => void
  removeProjectRoom: (id: string) => void
  addTeamMember: (roomId: string, role: TeamRole, name: string) => void
  removeTeamMember: (roomId: string, memberId: string) => void
  updateMemberActivity: (roomId: string, memberId: string, activity: TeamMember['activity']) => void
  submitApproval: (request: Omit<ApprovalRequest, 'id' | 'status' | 'createdAt'>) => void
  respondApproval: (id: string, approved: boolean) => void
  submitChatApproval: (req: Omit<ChatApprovalRequest, 'id' | 'status' | 'createdAt'>) => void
  respondChatApproval: (approved: boolean) => void
  addToolCall: (call: ToolCall) => void
  updateToolCallArguments: (id: string, chunk: string) => void
  addToolResult: (result: ToolResult) => void
  clearToolCalls: () => void
  notify: (title: string, body: string) => void
}

function getActiveTabFlat(chat: { tabs: TabState[]; activeTabId: string | null }): {
  messages: ChatMessage[]
  isLoading: boolean
  toolProgress: string | null
  sessionId: string | null
  reasoningContent: string
  chatApproval: ChatApprovalRequest | null
  activeToolCalls: ToolCall[]
  toolResults: ToolResult[]
} {
  const activeTab = chat.tabs.find(t => t.sessionId === chat.activeTabId)
  return {
    messages: activeTab?.messages ?? [],
    isLoading: activeTab?.isLoading ?? false,
    toolProgress: activeTab?.toolProgress ?? null,
    sessionId: chat.activeTabId,
    reasoningContent: activeTab?.reasoningContent ?? '',
    chatApproval: activeTab?.chatApproval ?? null,
    activeToolCalls: activeTab?.activeToolCalls ?? [],
    toolResults: activeTab?.toolResults ?? []
  }
}

function getCombinedState(): AppState {
  const theme = useThemeStore.getState()
  const chat = useChatStore.getState()
  const profile = useProfileStore.getState()
  const schedule = useScheduleStore.getState()
  const workflow = useWorkflowStore.getState()
  const office = useOfficeStore.getState()

  const flat = getActiveTabFlat(chat)

  return {
    theme: theme.theme,
    view: chat.view,
    canvasAgents: profile.canvasAgents,
    officeLayout: profile.officeLayout,
    soulPrompt: profile.soulPrompt,
    profiles: profile.profiles,
    activeProfileId: profile.activeProfileId,
    scheduledTasks: schedule.scheduledTasks,
    workflows: workflow.workflows,
    activeWorkflowId: workflow.activeWorkflowId,
    workflowExecution: workflow.workflowExecution,
    isAiConfigMode: chat.isAiConfigMode,
    projectRooms: office.projectRooms,
    approvalRequests: office.approvalRequests,

    tabs: chat.tabs,
    activeTabId: chat.activeTabId,
    openTab: chat.openTab,
    closeTab: chat.closeTab,
    switchTab: chat.switchTab,

    ...flat,

    setView: chat.setView,
    addMessage: chat.addMessage,
    appendToLastAgent: chat.appendToLastAgent,
    setLoading: chat.setLoading,
    setSessionId: chat.setSessionId,
    setToolProgress: chat.setToolProgress,
    setCanvasAgents: profile.setCanvasAgents,
    setOfficeLayout: profile.setOfficeLayout,
    setSoulPrompt: profile.setSoulPrompt,
    appendReasoning: chat.appendReasoning,
    clearReasoning: chat.clearReasoning,
    clearMessages: chat.clearMessages,
    switchProfile: profile.switchProfile,
    createProfile: profile.createProfile,
    deleteProfile: profile.deleteProfile,
    renameProfile: profile.renameProfile,
    addScheduledTask: schedule.addScheduledTask,
    updateScheduledTask: schedule.updateScheduledTask,
    deleteScheduledTask: schedule.deleteScheduledTask,
    tickScheduledTask: schedule.tickScheduledTask,
    createWorkflow: workflow.createWorkflow,
    updateWorkflow: workflow.updateWorkflow,
    deleteWorkflow: workflow.deleteWorkflow,
    setActiveWorkflow: workflow.setActiveWorkflow,
    updateWorkflowNodes: workflow.updateWorkflowNodes,
    updateWorkflowEdges: workflow.updateWorkflowEdges,
    startWorkflowExecution: workflow.startWorkflowExecution,
    updateNodeExecution: workflow.updateNodeExecution,
    completeWorkflowExecution: workflow.completeWorkflowExecution,
    setTheme: theme.setTheme,
    setAiConfigMode: chat.setAiConfigMode,
    addProjectRoom: office.addProjectRoom,
    removeProjectRoom: office.removeProjectRoom,
    addTeamMember: office.addTeamMember,
    removeTeamMember: office.removeTeamMember,
    updateMemberActivity: office.updateMemberActivity,
    submitApproval: office.submitApproval,
    respondApproval: office.respondApproval,
    submitChatApproval: chat.submitChatApproval,
    respondChatApproval: chat.respondChatApproval,
    addToolCall: chat.addToolCall,
    updateToolCallArguments: chat.updateToolCallArguments,
    addToolResult: chat.addToolResult,
    clearToolCalls: chat.clearToolCalls,
    notify: office.notify
  }
}

function routeSetState(patch: Partial<AppState>): void {
  if (patch.scheduledTasks !== undefined) {
    useScheduleStore.setState({ scheduledTasks: patch.scheduledTasks })
  }
  if (patch.workflows !== undefined) {
    useWorkflowStore.setState({ workflows: patch.workflows })
  }
  if (patch.chatApproval !== undefined) {
    const chat = useChatStore.getState()
    if (chat.activeTabId) {
      chat.updateTab(chat.activeTabId, { chatApproval: patch.chatApproval })
    }
  }
  if (patch.messages !== undefined) {
    const chat = useChatStore.getState()
    if (chat.activeTabId) {
      chat.updateTab(chat.activeTabId, { messages: patch.messages })
    }
  }
}

export interface UseAppStore {
  <T = AppState>(selector?: (state: AppState) => T): T
  getState: () => AppState
  setState: (partial: Partial<AppState>) => void
}

export const useAppStore: UseAppStore = function useAppStore<T = AppState>(
  selector?: (state: AppState) => T
): T {
  const theme = useThemeStore((s) => s.theme)
  const chatView = useChatStore((s) => s.view)
  const chatTabs = useChatStore((s) => s.tabs)
  const chatActiveTabId = useChatStore((s) => s.activeTabId)
  const chatAiConfigMode = useChatStore((s) => s.isAiConfigMode)
  const profileCanvasAgents = useProfileStore((s) => s.canvasAgents)
  const profileOfficeLayout = useProfileStore((s) => s.officeLayout)
  const profileSoulPrompt = useProfileStore((s) => s.soulPrompt)
  const profileProfiles = useProfileStore((s) => s.profiles)
  const profileActiveId = useProfileStore((s) => s.activeProfileId)
  const scheduleTasks = useScheduleStore((s) => s.scheduledTasks)
  const wfWorkflows = useWorkflowStore((s) => s.workflows)
  const wfActiveId = useWorkflowStore((s) => s.activeWorkflowId)
  const wfExecution = useWorkflowStore((s) => s.workflowExecution)
  const officeRooms = useOfficeStore((s) => s.projectRooms)
  const officeApprovals = useOfficeStore((s) => s.approvalRequests)

  // Derive flat fields from active tab for backward compatibility
  const activeTab = chatTabs.find(t => t.sessionId === chatActiveTabId)
  const flatMessages = activeTab?.messages ?? []
  const flatIsLoading = activeTab?.isLoading ?? false
  const flatToolProgress = activeTab?.toolProgress ?? null
  const flatSessionId = chatActiveTabId
  const flatReasoning = activeTab?.reasoningContent ?? ''
  const flatChatApproval = activeTab?.chatApproval ?? null
  const flatActiveToolCalls = activeTab?.activeToolCalls ?? []
  const flatToolResults = activeTab?.toolResults ?? []

  const state: AppState = {
    theme,
    view: chatView,
    canvasAgents: profileCanvasAgents,
    officeLayout: profileOfficeLayout,
    soulPrompt: profileSoulPrompt,
    profiles: profileProfiles,
    activeProfileId: profileActiveId,
    scheduledTasks: scheduleTasks,
    workflows: wfWorkflows,
    activeWorkflowId: wfActiveId,
    workflowExecution: wfExecution,
    isAiConfigMode: chatAiConfigMode,
    projectRooms: officeRooms,
    approvalRequests: officeApprovals,

    tabs: chatTabs,
    activeTabId: chatActiveTabId,
    openTab: useChatStore.getState().openTab,
    closeTab: useChatStore.getState().closeTab,
    switchTab: useChatStore.getState().switchTab,

    messages: flatMessages,
    isLoading: flatIsLoading,
    toolProgress: flatToolProgress,
    sessionId: flatSessionId,
    reasoningContent: flatReasoning,
    chatApproval: flatChatApproval,
    activeToolCalls: flatActiveToolCalls,
    toolResults: flatToolResults,

    setView: useChatStore.getState().setView,
    addMessage: useChatStore.getState().addMessage,
    appendToLastAgent: useChatStore.getState().appendToLastAgent,
    setLoading: useChatStore.getState().setLoading,
    setSessionId: useChatStore.getState().setSessionId,
    setToolProgress: useChatStore.getState().setToolProgress,
    setCanvasAgents: useProfileStore.getState().setCanvasAgents,
    setOfficeLayout: useProfileStore.getState().setOfficeLayout,
    setSoulPrompt: useProfileStore.getState().setSoulPrompt,
    appendReasoning: useChatStore.getState().appendReasoning,
    clearReasoning: useChatStore.getState().clearReasoning,
    clearMessages: useChatStore.getState().clearMessages,
    switchProfile: useProfileStore.getState().switchProfile,
    createProfile: useProfileStore.getState().createProfile,
    deleteProfile: useProfileStore.getState().deleteProfile,
    renameProfile: useProfileStore.getState().renameProfile,
    addScheduledTask: useScheduleStore.getState().addScheduledTask,
    updateScheduledTask: useScheduleStore.getState().updateScheduledTask,
    deleteScheduledTask: useScheduleStore.getState().deleteScheduledTask,
    tickScheduledTask: useScheduleStore.getState().tickScheduledTask,
    createWorkflow: useWorkflowStore.getState().createWorkflow,
    updateWorkflow: useWorkflowStore.getState().updateWorkflow,
    deleteWorkflow: useWorkflowStore.getState().deleteWorkflow,
    setActiveWorkflow: useWorkflowStore.getState().setActiveWorkflow,
    updateWorkflowNodes: useWorkflowStore.getState().updateWorkflowNodes,
    updateWorkflowEdges: useWorkflowStore.getState().updateWorkflowEdges,
    startWorkflowExecution: useWorkflowStore.getState().startWorkflowExecution,
    updateNodeExecution: useWorkflowStore.getState().updateNodeExecution,
    completeWorkflowExecution: useWorkflowStore.getState().completeWorkflowExecution,
    setTheme: useThemeStore.getState().setTheme,
    setAiConfigMode: useChatStore.getState().setAiConfigMode,
    addProjectRoom: useOfficeStore.getState().addProjectRoom,
    removeProjectRoom: useOfficeStore.getState().removeProjectRoom,
    addTeamMember: useOfficeStore.getState().addTeamMember,
    removeTeamMember: useOfficeStore.getState().removeTeamMember,
    updateMemberActivity: useOfficeStore.getState().updateMemberActivity,
    submitApproval: useOfficeStore.getState().submitApproval,
    respondApproval: useOfficeStore.getState().respondApproval,
    submitChatApproval: useChatStore.getState().submitChatApproval,
    respondChatApproval: useChatStore.getState().respondChatApproval,
    addToolCall: useChatStore.getState().addToolCall,
    updateToolCallArguments: useChatStore.getState().updateToolCallArguments,
    addToolResult: useChatStore.getState().addToolResult,
    clearToolCalls: useChatStore.getState().clearToolCalls,
    notify: useOfficeStore.getState().notify
  }

  if (selector) {
    return selector(state)
  }
  return state as T
} as UseAppStore

useAppStore.getState = getCombinedState
useAppStore.setState = routeSetState
