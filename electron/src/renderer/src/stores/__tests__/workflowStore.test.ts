import { describe, it, expect, beforeEach } from 'vitest'
import { useWorkflowStore } from '../workflowStore'

describe('workflowStore', () => {
  beforeEach(() => {
    useWorkflowStore.setState({ workflows: [], activeWorkflowId: null, workflowExecution: null })
  })

  describe('createWorkflow', () => {
    it('creates a workflow with a start node', () => {
      const id = useWorkflowStore.getState().createWorkflow('测试流程')
      expect(id).toBeTruthy()
      expect(useWorkflowStore.getState().workflows).toHaveLength(1)
      const wf = useWorkflowStore.getState().workflows[0]
      expect(wf.name).toBe('测试流程')
      expect(wf.nodes).toHaveLength(1)
      expect(wf.nodes[0].type).toBe('start')
    })

    it('sets activeWorkflowId', () => {
      const id = useWorkflowStore.getState().createWorkflow('A')
      expect(useWorkflowStore.getState().activeWorkflowId).toBe(id)
    })

    it('generates unique IDs', () => {
      const id1 = useWorkflowStore.getState().createWorkflow('A')
      const id2 = useWorkflowStore.getState().createWorkflow('B')
      expect(id1).not.toBe(id2)
    })
  })

  describe('updateWorkflow', () => {
    it('updates name and description', () => {
      const id = useWorkflowStore.getState().createWorkflow('Old')
      useWorkflowStore.getState().updateWorkflow(id, { name: 'New', description: 'Updated' })
      const wf = useWorkflowStore.getState().workflows.find((w) => w.id === id)!
      expect(wf.name).toBe('New')
      expect(wf.description).toBe('Updated')
    })

    it('updates updatedAt timestamp', () => {
      const id = useWorkflowStore.getState().createWorkflow('Test')
      const before = useWorkflowStore.getState().workflows[0].updatedAt
      useWorkflowStore.getState().updateWorkflow(id, { name: 'Updated' })
      expect(useWorkflowStore.getState().workflows[0].updatedAt).toBeGreaterThanOrEqual(before)
    })

    it('no-ops for non-existent workflow id', () => {
      const id = useWorkflowStore.getState().createWorkflow('Exists')
      useWorkflowStore.getState().updateWorkflow('nonexistent', { name: 'Ghost' })
      const wfs = useWorkflowStore.getState().workflows
      expect(wfs).toHaveLength(1)
      expect(wfs[0].name).toBe('Exists')
      expect(wfs[0].id).toBe(id)
    })

    it('updates description only', () => {
      const id = useWorkflowStore.getState().createWorkflow('Name')
      useWorkflowStore.getState().updateWorkflow(id, { description: 'New desc' })
      const wf = useWorkflowStore.getState().workflows.find((w) => w.id === id)!
      expect(wf.name).toBe('Name')
      expect(wf.description).toBe('New desc')
    })
  })

  describe('deleteWorkflow', () => {
    it('removes a workflow', () => {
      useWorkflowStore.getState().createWorkflow('A')
      const id = useWorkflowStore.getState().createWorkflow('B')
      useWorkflowStore.getState().deleteWorkflow(id)
      expect(useWorkflowStore.getState().workflows).toHaveLength(1)
      expect(useWorkflowStore.getState().workflows[0].name).toBe('A')
    })

    it('clears activeWorkflowId if deleted', () => {
      const id = useWorkflowStore.getState().createWorkflow('A')
      expect(useWorkflowStore.getState().activeWorkflowId).toBe(id)
      useWorkflowStore.getState().deleteWorkflow(id)
      expect(useWorkflowStore.getState().activeWorkflowId).toBeNull()
    })
  })

  describe('updateWorkflowNodes', () => {
    it('replaces nodes', () => {
      const id = useWorkflowStore.getState().createWorkflow('Test')
      const newNodes = [
        { id: 'n1', type: 'agent' as const, position: { x: 0, y: 0 }, data: { label: 'Agent 1' } },
      ]
      useWorkflowStore.getState().updateWorkflowNodes(id, newNodes)
      const wf = useWorkflowStore.getState().workflows.find((w) => w.id === id)!
      expect(wf.nodes).toHaveLength(1)
      expect(wf.nodes[0].id).toBe('n1')
    })
  })

  describe('updateWorkflowEdges', () => {
    it('replaces edges', () => {
      const id = useWorkflowStore.getState().createWorkflow('Test')
      const newEdges = [
        { id: 'e1', source: 'n1', target: 'n2' },
      ]
      useWorkflowStore.getState().updateWorkflowEdges(id, newEdges)
      const wf = useWorkflowStore.getState().workflows.find((w) => w.id === id)!
      expect(wf.edges).toHaveLength(1)
    })
  })

  describe('execution', () => {
    it('starts execution', () => {
      const id = useWorkflowStore.getState().createWorkflow('Test')
      useWorkflowStore.getState().startWorkflowExecution(id)
      const exec = useWorkflowStore.getState().workflowExecution!
      expect(exec).toBeDefined()
      expect(exec.workflowId).toBe(id)
      expect(exec.status).toBe('running')
      expect(exec.nodeStatuses).toEqual({})
    })

    it('updates node execution status', () => {
      useWorkflowStore.getState().createWorkflow('Test')
      useWorkflowStore.getState().startWorkflowExecution('wf-test')
      useWorkflowStore.getState().updateNodeExecution('node-1', 'completed', 'done')
      const exec = useWorkflowStore.getState().workflowExecution!
      expect(exec.nodeStatuses['node-1']).toBe('completed')
      expect(exec.nodeOutputs['node-1']).toBe('done')
    })

    it('completes execution', () => {
      useWorkflowStore.getState().createWorkflow('Test')
      useWorkflowStore.getState().startWorkflowExecution('wf-test')
      useWorkflowStore.getState().completeWorkflowExecution('completed')
      const exec = useWorkflowStore.getState().workflowExecution!
      expect(exec.status).toBe('completed')
      expect(exec.completedAt).toBeGreaterThan(0)
    })

    it('no-ops updateNodeExecution when no execution', () => {
      useWorkflowStore.getState().updateNodeExecution('node-1', 'completed')
      expect(useWorkflowStore.getState().workflowExecution).toBeNull()
    })

    it('updateNodeExecution without output does not add to nodeOutputs', () => {
      const id = useWorkflowStore.getState().createWorkflow('Test')
      useWorkflowStore.getState().startWorkflowExecution(id)
      useWorkflowStore.getState().updateNodeExecution('node-1', 'running')
      const exec = useWorkflowStore.getState().workflowExecution!
      expect(exec.nodeStatuses['node-1']).toBe('running')
      expect(exec.nodeOutputs['node-1']).toBeUndefined()
    })

    it('updateNodeExecution with output stores it', () => {
      const id = useWorkflowStore.getState().createWorkflow('Test')
      useWorkflowStore.getState().startWorkflowExecution(id)
      useWorkflowStore.getState().updateNodeExecution('node-1', 'completed', 'result text')
      const exec = useWorkflowStore.getState().workflowExecution!
      expect(exec.nodeStatuses['node-1']).toBe('completed')
      expect(exec.nodeOutputs['node-1']).toBe('result text')
    })

    it('completes execution with failed status', () => {
      const id = useWorkflowStore.getState().createWorkflow('Test')
      useWorkflowStore.getState().startWorkflowExecution(id)
      useWorkflowStore.getState().completeWorkflowExecution('failed')
      const exec = useWorkflowStore.getState().workflowExecution!
      expect(exec.status).toBe('failed')
      expect(exec.completedAt).toBeGreaterThan(0)
    })

    it('completeWorkflowExecution no-ops when no execution', () => {
      useWorkflowStore.getState().completeWorkflowExecution('completed')
      expect(useWorkflowStore.getState().workflowExecution).toBeNull()
    })

    it('completeWorkflowExecution with failed status no-ops when no execution', () => {
      useWorkflowStore.getState().completeWorkflowExecution('failed')
      expect(useWorkflowStore.getState().workflowExecution).toBeNull()
    })
  })
})
