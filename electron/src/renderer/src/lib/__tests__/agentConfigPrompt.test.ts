import { describe, it, expect } from 'vitest'
import { parseAgentConfigResponse, AGENT_CONFIG_SYSTEM_PROMPT } from '../agentConfigPrompt'

describe('AGENT_CONFIG_SYSTEM_PROMPT', () => {
  it('contains JSON output format instructions', () => {
    expect(AGENT_CONFIG_SYSTEM_PROMPT).toContain('```json')
    expect(AGENT_CONFIG_SYSTEM_PROMPT).toContain('nodes')
    expect(AGENT_CONFIG_SYSTEM_PROMPT).toContain('edges')
  })

  it('lists available models', () => {
    expect(AGENT_CONFIG_SYSTEM_PROMPT).toContain('gpt-4o')
    expect(AGENT_CONFIG_SYSTEM_PROMPT).toContain('claude')
  })

  it('lists available tools', () => {
    expect(AGENT_CONFIG_SYSTEM_PROMPT).toContain('web')
    expect(AGENT_CONFIG_SYSTEM_PROMPT).toContain('code')
  })
})

describe('parseAgentConfigResponse', () => {
  const validJson = JSON.stringify({
    name: 'Research Team',
    description: 'A research team',
    nodes: [
      {
        type: 'agent',
        data: { label: 'Researcher', role: 'Research topics', model: 'gpt-4o', color: '#6366f1', tools: ['web'] },
        position: { x: 200, y: 100 },
      },
      {
        type: 'agent',
        data: { label: 'Writer', role: 'Write reports', model: 'glm-4-flash', color: '#10b981', tools: ['code'] },
        position: { x: 200, y: 300 },
      },
    ],
    edges: [
      { source: 'agent-0', target: 'agent-1', data: { label: 'Research results', animated: true } },
    ],
  })

  it('parses valid JSON wrapped in code fence', () => {
    const raw = `Here is the config:\n\`\`\`json\n${validJson}\n\`\`\`\nDone.`
    const result = parseAgentConfigResponse(raw)
    expect(result).not.toBeNull()
    expect(result!.name).toBe('Research Team')
    expect(result!.nodes).toHaveLength(2)
    expect(result!.edges).toHaveLength(1)
  })

  it('parses raw JSON without code fence', () => {
    const result = parseAgentConfigResponse(validJson)
    expect(result).not.toBeNull()
    expect(result!.name).toBe('Research Team')
  })

  it('generates unique id for the template', () => {
    const result = parseAgentConfigResponse(validJson)
    expect(result!.id).toMatch(/^ai-/)
  })

  it('fills defaults for missing node fields', () => {
    const minimal = JSON.stringify({
      nodes: [{ data: {} }],
      edges: [],
    })
    const result = parseAgentConfigResponse(minimal)
    expect(result!.nodes[0].data.label).toBe('Agent 1')
    expect(result!.nodes[0].data.model).toBe('gpt-4o')
    expect(result!.nodes[0].data.tools).toEqual([])
  })

  it('assigns default positions when missing', () => {
    const noPos = JSON.stringify({ nodes: [{ data: { label: 'A' } }] })
    const result = parseAgentConfigResponse(noPos)
    expect(result!.nodes[0].position).toBeDefined()
    expect(result!.nodes[0].position.x).toBeGreaterThan(0)
  })

  it('assigns colors from palette when missing', () => {
    const noColor = JSON.stringify({
      nodes: [
        { data: { label: 'A' } },
        { data: { label: 'B' } },
      ],
    })
    const result = parseAgentConfigResponse(noColor)
    expect(result!.nodes[0].data.color).toBeDefined()
    expect(result!.nodes[1].data.color).toBeDefined()
  })

  it('handles missing edges array', () => {
    const noEdges = JSON.stringify({ nodes: [{ data: { label: 'A' } }] })
    const result = parseAgentConfigResponse(noEdges)
    expect(result!.edges).toEqual([])
  })

  it('returns null for invalid JSON', () => {
    expect(parseAgentConfigResponse('not json at all')).toBeNull()
  })

  it('returns null when nodes array missing', () => {
    expect(parseAgentConfigResponse('{"edges":[]}')).toBeNull()
  })

  it('extracts JSON from brace matching when no fence', () => {
    const wrapped = `Some text before {${validJson.slice(1, -1)}} and after`
    const result = parseAgentConfigResponse(wrapped)
    expect(result).not.toBeNull()
  })

  it('handles edge defaults for missing fields', () => {
    const withMinimalEdges = JSON.stringify({
      nodes: [{ data: { label: 'A' } }],
      edges: [{ source: 'agent-0' }],
    })
    const result = parseAgentConfigResponse(withMinimalEdges)
    expect(result!.edges[0].target).toBe('agent-1')
    expect(result!.edges[0].data!.label).toBe('')
    expect(result!.edges[0].data!.animated).toBe(false)
  })
})
