import { describe, it, expect } from 'vitest'
import { canvasToWorkflow } from '../canvasToWorkflow'
import type { CanvasAgent } from '../../stores/app'

function makeAgent(overrides: Partial<CanvasAgent> & { id: string }): CanvasAgent {
  return {
    label: 'Agent',
    role: 'test role',
    model: 'gpt-4o',
    color: '#6366f1',
    position: { x: 0, y: 0 },
    connections: [],
    tools: [],
    status: 'idle',
    ...overrides
  }
}

describe('canvasToWorkflow', () => {
  it('creates start and end nodes', () => {
    const agents = [makeAgent({ id: 'a1' })]
    const connections = new Map<string, string[]>()

    const wf = canvasToWorkflow(agents, connections)

    expect(wf.nodes).toHaveLength(3) // start + agent + end
    expect(wf.nodes[0].type).toBe('start')
    expect(wf.nodes[2].type).toBe('end')
  })

  it('maps each agent to a workflow node of type agent', () => {
    const agents = [
      makeAgent({ id: 'a1', label: 'Writer', role: 'write content', model: 'gpt-4o' }),
      makeAgent({ id: 'a2', label: 'Reviewer', role: 'review content', model: 'claude' })
    ]
    const connections = new Map<string, string[]>([['a1', ['a2']]])

    const wf = canvasToWorkflow(agents, connections)

    const agentNodes = wf.nodes.filter((n) => n.type === 'agent')
    expect(agentNodes).toHaveLength(2)
    expect(agentNodes[0].data.label).toBe('Writer')
    expect(agentNodes[0].data.prompt).toBe('write content')
    expect(agentNodes[0].data.model).toBe('gpt-4o')
    expect(agentNodes[1].data.label).toBe('Reviewer')
  })

  it('creates linear chain: start -> agent -> end for single agent', () => {
    const agents = [makeAgent({ id: 'a1' })]
    const connections = new Map<string, string[]>()

    const wf = canvasToWorkflow(agents, connections)

    expect(wf.edges).toHaveLength(2)
    expect(wf.edges[0].source).toBe('canvas-start')
    expect(wf.edges[0].target).toBe('a1')
    expect(wf.edges[1].source).toBe('a1')
    expect(wf.edges[1].target).toBe('canvas-end')
  })

  it('creates linear chain following connections', () => {
    const agents = [
      makeAgent({ id: 'a1' }),
      makeAgent({ id: 'a2' }),
      makeAgent({ id: 'a3' })
    ]
    const connections = new Map<string, string[]>([
      ['a1', ['a2']],
      ['a2', ['a3']]
    ])

    const wf = canvasToWorkflow(agents, connections)

    expect(wf.edges).toHaveLength(4) // start->a1, a1->a2, a2->a3, a3->end
    expect(wf.edges[0]).toMatchObject({ source: 'canvas-start', target: 'a1' })
    expect(wf.edges[1]).toMatchObject({ source: 'a1', target: 'a2' })
    expect(wf.edges[2]).toMatchObject({ source: 'a2', target: 'a3' })
    expect(wf.edges[3]).toMatchObject({ source: 'a3', target: 'canvas-end' })
  })

  it('returns empty agent nodes when no agents provided', () => {
    const wf = canvasToWorkflow([], new Map())

    expect(wf.nodes).toHaveLength(2) // only start + end
    expect(wf.edges).toHaveLength(0)
  })

  it('sorts by position when no clear root (all interconnected)', () => {
    const agents = [
      makeAgent({ id: 'a1', position: { x: 0, y: 200 } }),
      makeAgent({ id: 'a2', position: { x: 0, y: 100 } }),
      makeAgent({ id: 'a3', position: { x: 0, y: 300 } })
    ]
    // All agents are targets, no clear root
    const connections = new Map<string, string[]>([
      ['a1', ['a2']],
      ['a2', ['a3']],
      ['a3', ['a1']]
    ])

    const wf = canvasToWorkflow(agents, connections)

    // Should still produce a linear chain (sorted by y position)
    expect(wf.edges[0].target).toBe('a2') // y=100 first
  })

  it('appends unvisited agents at the end', () => {
    const agents = [
      makeAgent({ id: 'a1', position: { x: 0, y: 0 } }),
      makeAgent({ id: 'a2', position: { x: 0, y: 100 } }),
      makeAgent({ id: 'orphan', position: { x: 300, y: 50 } })
    ]
    const connections = new Map<string, string[]>([['a1', ['a2']]])

    const wf = canvasToWorkflow(agents, connections)

    // a1 is root, a1->a2, then orphan appended
    const lastEdge = wf.edges[wf.edges.length - 1]
    expect(lastEdge.target).toBe('canvas-end')
  })

  it('sets workflow metadata correctly', () => {
    const agents = [makeAgent({ id: 'a1' })]
    const wf = canvasToWorkflow(agents, new Map())

    expect(wf.name).toBe('画布工作流')
    expect(wf.description).toContain('1 agents')
    expect(wf.id).toMatch(/^wf-/)
    expect(wf.createdAt).toBeGreaterThan(0)
    expect(wf.updatedAt).toBeGreaterThan(0)
  })
})
