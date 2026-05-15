import { create } from 'zustand'
import { genId } from '../lib/genId'
import type { Workflow, WorkflowNode, WorkflowEdge, WorkflowExecution, NodeExecutionStatus } from '../../../shared/types'

interface WorkflowState {
  workflows: Workflow[]
  activeWorkflowId: string | null
  workflowExecution: WorkflowExecution | null
  createWorkflow: (name: string) => string
  updateWorkflow: (id: string, patch: Partial<Workflow>) => void
  deleteWorkflow: (id: string) => void
  setActiveWorkflow: (id: string | null) => void
  updateWorkflowNodes: (id: string, nodes: WorkflowNode[]) => void
  updateWorkflowEdges: (id: string, edges: WorkflowEdge[]) => void
  startWorkflowExecution: (workflowId: string) => void
  updateNodeExecution: (nodeId: string, status: NodeExecutionStatus, output?: string) => void
  completeWorkflowExecution: (status: 'completed' | 'failed') => void
}

export const useWorkflowStore = create<WorkflowState>((set) => ({
  workflows: [],
  activeWorkflowId: null,
  workflowExecution: null,

  createWorkflow: (name) => {
    const id = genId('wf-')
    const now = Date.now()
    const startNode: WorkflowNode = {
      id: 'start-1',
      type: 'start',
      position: { x: 250, y: 50 },
      data: { label: '开始' }
    }
    const workflow: Workflow = { id, name, description: '', nodes: [startNode], edges: [], createdAt: now, updatedAt: now }
    set((s) => ({ workflows: [...s.workflows, workflow], activeWorkflowId: id }))
    return id
  },

  updateWorkflow: (id, patch) =>
    set((s) => ({
      workflows: s.workflows.map((w) =>
        w.id === id ? { ...w, ...patch, updatedAt: Date.now() } : w
      )
    })),

  deleteWorkflow: (id) =>
    set((s) => ({
      workflows: s.workflows.filter((w) => w.id !== id),
      activeWorkflowId: s.activeWorkflowId === id ? null : s.activeWorkflowId
    })),

  setActiveWorkflow: (id) => set({ activeWorkflowId: id }),

  updateWorkflowNodes: (id, nodes) =>
    set((s) => ({
      workflows: s.workflows.map((w) =>
        w.id === id ? { ...w, nodes, updatedAt: Date.now() } : w
      )
    })),

  updateWorkflowEdges: (id, edges) =>
    set((s) => ({
      workflows: s.workflows.map((w) =>
        w.id === id ? { ...w, edges, updatedAt: Date.now() } : w
      )
    })),

  startWorkflowExecution: (workflowId) => {
    const execution: WorkflowExecution = {
      id: genId('exec-'),
      workflowId,
      startedAt: Date.now(),
      completedAt: null,
      nodeStatuses: {},
      nodeOutputs: {},
      status: 'running'
    }
    set({ workflowExecution: execution })
  },

  updateNodeExecution: (nodeId, status, output) =>
    set((s) => {
      if (!s.workflowExecution) return {}
      return {
        workflowExecution: {
          ...s.workflowExecution,
          nodeStatuses: { ...s.workflowExecution.nodeStatuses, [nodeId]: status },
          nodeOutputs: output !== undefined
            ? { ...s.workflowExecution.nodeOutputs, [nodeId]: output }
            : s.workflowExecution.nodeOutputs
        }
      }
    }),

  completeWorkflowExecution: (status) =>
    set((s) => {
      if (!s.workflowExecution) return {}
      return {
        workflowExecution: {
          ...s.workflowExecution,
          status,
          completedAt: Date.now()
        }
      }
    })
}))
