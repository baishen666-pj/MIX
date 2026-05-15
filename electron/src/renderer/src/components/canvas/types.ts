import type { Node, Edge, XYPosition } from '@xyflow/react'

export interface AgentNodeData {
  [key: string]: unknown
  label: string
  role: string
  model: string
  status: 'idle' | 'running' | 'error' | 'success'
  color: string
  tools: string[]
}

export type AgentNode = Node<AgentNodeData, 'agent'>

export interface FlowEdgeData {
  [key: string]: unknown
  label?: string
  animated?: boolean
}

export type FlowEdge = Edge<FlowEdgeData>

export interface TemplateNode {
  type: 'agent'
  data: AgentNodeData
  position: XYPosition
}

export interface TemplateEdge {
  source: string
  target: string
  data?: FlowEdgeData
}

export interface FlowTemplate {
  id: string
  name: string
  description: string
  nodes: TemplateNode[]
  edges: TemplateEdge[]
}
