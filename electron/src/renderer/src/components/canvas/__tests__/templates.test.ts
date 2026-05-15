import { describe, it, expect } from 'vitest'
import { TEMPLATES } from '../templates'

describe('TEMPLATES', () => {
  it('has at least 4 templates', () => {
    expect(TEMPLATES.length).toBeGreaterThanOrEqual(4)
  })

  it('each template has a unique id', () => {
    const ids = TEMPLATES.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('each template has required fields', () => {
    for (const t of TEMPLATES) {
      expect(t.id).toBeTruthy()
      expect(t.name).toBeTruthy()
      expect(t.description).toBeTruthy()
      expect(Array.isArray(t.nodes)).toBe(true)
      expect(Array.isArray(t.edges)).toBe(true)
    }
  })

  it('sequential template has 3 agent nodes in pipeline', () => {
    const seq = TEMPLATES.find((t) => t.id === 'sequential')
    expect(seq).toBeDefined()
    expect(seq!.nodes).toHaveLength(3)
    expect(seq!.nodes.every((n) => n.type === 'agent')).toBe(true)
    expect(seq!.edges).toHaveLength(2)
  })

  it('parallel template has fan-out edges', () => {
    const par = TEMPLATES.find((t) => t.id === 'parallel')
    expect(par).toBeDefined()
    expect(par!.nodes.length).toBeGreaterThanOrEqual(3)
    // Coordinator fans out to analysts
    const outgoing = par!.edges.filter((e) => e.source === 'agent-0')
    expect(outgoing.length).toBeGreaterThanOrEqual(3)
  })

  it('debate template has bidirectional edges between debaters', () => {
    const debate = TEMPLATES.find((t) => t.id === 'debate')
    expect(debate).toBeDefined()
    const agent1To2 = debate!.edges.find((e) => e.source === 'agent-1' && e.target === 'agent-2')
    const agent2To1 = debate!.edges.find((e) => e.source === 'agent-2' && e.target === 'agent-1')
    expect(agent1To2).toBeDefined()
    expect(agent2To1).toBeDefined()
  })

  it('supervisor template has hierarchical edges', () => {
    const sup = TEMPLATES.find((t) => t.id === 'supervisor')
    expect(sup).toBeDefined()
    // Supervisor dispatches to sub-agents
    const fromSupervisor = sup!.edges.filter((e) => e.source === 'agent-0')
    expect(fromSupervisor.length).toBeGreaterThanOrEqual(2)
  })

  it('all nodes have data with label, role, model, status, color', () => {
    for (const t of TEMPLATES) {
      for (const node of t.nodes) {
        expect(node.data.label).toBeTruthy()
        expect(node.data.role).toBeTruthy()
        expect(node.data.model).toBeTruthy()
        expect(node.data.status).toBe('idle')
        expect(node.data.color).toMatch(/^#[0-9a-f]{6}$/)
      }
    }
  })

  it('all edge sources and targets reference existing node indices', () => {
    for (const t of TEMPLATES) {
      const nodeIds = new Set(t.nodes.map((_, i) => `agent-${i}`))
      for (const edge of t.edges) {
        expect(nodeIds.has(edge.source) || edge.source.startsWith('agent-')).toBe(true)
        expect(nodeIds.has(edge.target) || edge.target.startsWith('agent-')).toBe(true)
      }
    }
  })

  it('edge data has optional label and animated fields', () => {
    for (const t of TEMPLATES) {
      for (const edge of t.edges) {
        if (edge.data) {
          if (edge.data.label !== undefined) {
            expect(typeof edge.data.label).toBe('string')
          }
          if (edge.data.animated !== undefined) {
            expect(typeof edge.data.animated).toBe('boolean')
          }
        }
      }
    }
  })
})
