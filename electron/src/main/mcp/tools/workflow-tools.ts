/**
 * MCP tool handlers: workflow.list and workflow.execute
 */

import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import * as persistence from '../../persistence'
import { sendMessage } from '../../chat'
import { getActiveProvider } from '../../config'

export function registerWorkflowListTool(server: McpServer): void {
  server.registerTool(
    'workflow.list',
    {
      description: 'List all saved workflows.',
      inputSchema: {}
    },
    async () => {
      const rows = persistence.getAllWorkflows()
      const workflows = rows.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        createdAt: r.created_at,
        updatedAt: r.updated_at
      }))
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(workflows, null, 2) }]
      }
    }
  )
}

export function registerWorkflowExecuteTool(server: McpServer): void {
  server.registerTool(
    'workflow.execute',
    {
      description: 'Execute a saved workflow by ID. Returns the outputs of each node.',
      inputSchema: {
        workflowId: z.string().describe('The workflow ID to execute.')
      }
    },
    async (args) => {
      const workflowId = args.workflowId
      if (!workflowId) {
        return {
          content: [{ type: 'text' as const, text: 'Error: workflowId is required' }],
          isError: true
        }
      }

      const rows = persistence.getAllWorkflows()
      const wf = rows.find((r) => r.id === workflowId)
      if (!wf) {
        return {
          content: [{ type: 'text' as const, text: `Error: Workflow not found: ${workflowId}` }],
          isError: true
        }
      }

      const nodes = JSON.parse(wf.nodes) as Array<{
        id: string
        type: string
        data: { label: string; prompt?: string; model?: string; condition?: string }
      }>
      const edges = JSON.parse(wf.edges) as Array<{
        id: string
        source: string
        target: string
        sourceHandle?: string
      }>

      try {
        const result = await executeWorkflow(nodes, edges)
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }]
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        return {
          content: [{ type: 'text' as const, text: `Error: ${msg}` }],
          isError: true
        }
      }
    }
  )
}

interface WorkflowNode {
  id: string
  type: string
  data: { label: string; prompt?: string; model?: string; condition?: string }
}

interface WorkflowEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string
}

interface NodeOutput {
  nodeId: string
  label: string
  status: 'completed' | 'skipped' | 'failed'
  output: string
}

async function executeWorkflow(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[]
): Promise<{ nodeOutputs: NodeOutput[]; status: string }> {
  const provider = getActiveProvider()
  const outputs: NodeOutput[] = []

  // Build adjacency: source -> targets
  const adjacency = new Map<string, Array<{ target: string; sourceHandle?: string }>>()
  for (const edge of edges) {
    const list = adjacency.get(edge.source) || []
    list.push({ target: edge.target, sourceHandle: edge.sourceHandle })
    adjacency.set(edge.source, list)
  }

  // Find start nodes
  const startNodes = nodes.filter((n) => n.type === 'start')
  if (startNodes.length === 0 && nodes.length > 0) {
    startNodes.push(nodes[0])
  }

  const visited = new Set<string>()
  const queue = startNodes.map((n) => n.id)

  while (queue.length > 0) {
    const currentId = queue.shift()!
    if (visited.has(currentId)) continue
    visited.add(currentId)

    const node = nodes.find((n) => n.id === currentId)
    if (!node) continue

    if (node.type === 'start' || node.type === 'end') {
      outputs.push({ nodeId: node.id, label: node.data.label, status: 'completed', output: '' })
    } else if (node.type === 'agent') {
      const prompt = node.data.prompt || node.data.label
      try {
        const response = await runAgentCompletion(provider, node.data.model, prompt)
        outputs.push({ nodeId: node.id, label: node.data.label, status: 'completed', output: response })
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        outputs.push({ nodeId: node.id, label: node.data.label, status: 'failed', output: msg })
      }
    } else if (node.type === 'condition') {
      const prevOutput = outputs.length > 0 ? outputs[outputs.length - 1].output : ''
      const condition = node.data.condition || ''
      let passed = true
      if (condition === 'yes' || condition === 'true' || condition === '1') passed = true
      else if (condition === 'no' || condition === 'false' || condition === '0') passed = false
      else passed = prevOutput.length > 0
      outputs.push({ nodeId: node.id, label: node.data.label, status: 'completed', output: passed ? 'yes' : 'no' })
    }

    const targets = adjacency.get(currentId) || []
    for (const t of targets) {
      if (!visited.has(t.target)) {
        queue.push(t.target)
      }
    }
  }

  const hasFailed = outputs.some((o) => o.status === 'failed')
  return { nodeOutputs: outputs, status: hasFailed ? 'failed' : 'completed' }
}

function runAgentCompletion(
  provider: ReturnType<typeof getActiveProvider>,
  model: string | undefined,
  prompt: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    let accumulated = ''
    const controller = sendMessage(
      { messages: [{ role: 'user', content: prompt }], model },
      {
        onChunk(chunk) { accumulated += chunk },
        onDone() { resolve(accumulated) },
        onError(msg) { reject(new Error(msg)) }
      }
    )
    setTimeout(() => {
      controller.abort()
      if (accumulated) resolve(accumulated)
      else reject(new Error('Workflow node timed out'))
    }, 60000)
  })
}
