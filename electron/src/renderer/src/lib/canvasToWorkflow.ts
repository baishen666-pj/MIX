import { genId } from './genId'
import type { Workflow, WorkflowNode, WorkflowEdge } from '../../../shared/types'
import type { CanvasAgent } from '../stores/app'

const NODE_SPACING_X = 250
const START_Y = 50
const AGENT_Y = 150
const END_Y = 250

export function canvasToWorkflow(agents: CanvasAgent[], connections: Map<string, string[]>): Workflow {
  const workflowId = genId('wf-')
  const now = Date.now()

  const startNode: WorkflowNode = {
    id: 'canvas-start',
    type: 'start',
    position: { x: 0, y: START_Y },
    data: { label: '开始' }
  }

  const agentNodes: WorkflowNode[] = agents.map((agent, i) => ({
    id: agent.id,
    type: 'agent' as const,
    position: { x: (i + 1) * NODE_SPACING_X, y: AGENT_Y },
    data: {
      label: agent.label,
      prompt: agent.role,
      model: agent.model
    }
  }))

  const endNode: WorkflowNode = {
    id: 'canvas-end',
    type: 'end',
    position: { x: (agents.length + 1) * NODE_SPACING_X, y: END_Y },
    data: { label: '结束' }
  }

  const nodes = [startNode, ...agentNodes, endNode]

  const orderedIds = getLinearOrder(agents, connections)

  const edges: WorkflowEdge[] = []

  // start -> first agent
  if (orderedIds.length > 0) {
    edges.push({
      id: genId('edge-'),
      source: 'canvas-start',
      target: orderedIds[0]
    })
  }

  // agent -> agent (linear)
  for (let i = 0; i < orderedIds.length - 1; i++) {
    edges.push({
      id: genId('edge-'),
      source: orderedIds[i],
      target: orderedIds[i + 1]
    })
  }

  // last agent -> end
  if (orderedIds.length > 0) {
    edges.push({
      id: genId('edge-'),
      source: orderedIds[orderedIds.length - 1],
      target: 'canvas-end'
    })
  }

  return {
    id: workflowId,
    name: '画布工作流',
    description: `从画布生成 (${agents.length} agents)`,
    nodes,
    edges,
    createdAt: now,
    updatedAt: now
  }
}

function getLinearOrder(agents: CanvasAgent[], connections: Map<string, string[]>): string[] {
  if (agents.length === 0) return []

  // Find root agents: those not targeted by any connection
  const allTargets = new Set<string>()
  for (const targets of connections.values()) {
    for (const t of targets) {
      allTargets.add(t)
    }
  }

  const agentIds = new Set(agents.map((a) => a.id))
  const roots = agents.filter((a) => !allTargets.has(a.id))

  // If no clear root (cyclic or fully connected), use canvas order (top-to-bottom, left-to-right)
  if (roots.length === 0) {
    return agents
      .slice()
      .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x)
      .map((a) => a.id)
  }

  // If multiple roots, sort by position and chain them linearly
  if (roots.length > 1) {
    const sorted = agents
      .slice()
      .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x)
    return sorted.map((a) => a.id)
  }

  // Single root: follow connections linearly
  const ordered: string[] = []
  const visited = new Set<string>()
  let current: string | null = roots[0].id

  while (current && !visited.has(current)) {
    if (!agentIds.has(current)) break
    visited.add(current)
    ordered.push(current)
    const targets: string[] = connections.get(current) || []
    current = targets.length > 0 ? targets[0] : null
  }

  // Append any unvisited agents at the end
  for (const agent of agents) {
    if (!visited.has(agent.id)) {
      ordered.push(agent.id)
    }
  }

  return ordered
}
