import { genId } from '../../lib/genId'
import { useCallback, useState, useEffect } from 'react'
import {
  ReactFlow,
  Controls,
  Background,
  MiniMap,
  addEdge,
  applyNodeChanges,
  useNodesState,
  useEdgesState,
  type OnConnect,
  type DefaultEdgeOptions,
  type Node,
  type NodeChange,
  type Edge,
  type NodeMouseHandler
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { workflowNodeTypes } from './WorkflowNodes'
import { WorkflowProperties } from './WorkflowProperties'
import { WorkflowExecutor } from './WorkflowExecutor'
import { useAppStore } from '../../stores/app'
import type { WorkflowNode as WFNode, WorkflowEdge as WFEdge } from '../../../../shared/types'

const defaultEdgeOptions: DefaultEdgeOptions = {
  type: 'smoothstep',
  style: { stroke: 'var(--t-border-default)', strokeWidth: 1.5 },
  labelStyle: { fill: 'var(--t-content-subtle)', fontSize: 10 },
  labelBgStyle: { fill: 'var(--t-surface-elevated)', fillOpacity: 0.9 },
  labelBgPadding: [6, 3] as [number, number],
  labelBgBorderRadius: 4,
  markerEnd: { type: 'arrowclosed' as const, color: 'var(--t-border-default)' }
}

export function WorkflowEditor() {
  const workflows = useAppStore((s) => s.workflows)
  const activeWorkflowId = useAppStore((s) => s.activeWorkflowId)
  const createWorkflow = useAppStore((s) => s.createWorkflow)
  const deleteWorkflow = useAppStore((s) => s.deleteWorkflow)
  const setActiveWorkflow = useAppStore((s) => s.setActiveWorkflow)
  const updateWorkflowNodes = useAppStore((s) => s.updateWorkflowNodes)
  const updateWorkflowEdges = useAppStore((s) => s.updateWorkflowEdges)
  const workflowExecution = useAppStore((s) => s.workflowExecution)
  const [nodes, setNodes] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)

  const activeWorkflow = workflows.find((w) => w.id === activeWorkflowId)

  // Sync active workflow to React Flow
  useEffect(() => {
    if (!activeWorkflow) {
      setNodes([])
      setEdges([])
      return
    }

    const rfNodes: Node[] = activeWorkflow.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      position: n.position,
      data: {
        ...n.data,
        executionStatus: workflowExecution?.nodeStatuses[n.id] || 'idle'
      }
    }))

    const rfEdges: Edge[] = activeWorkflow.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      label: e.label
    }))

    setNodes(rfNodes)
    setEdges(rfEdges)
  }, [activeWorkflow?.id, activeWorkflow?.nodes.length, activeWorkflow?.edges.length, workflowExecution, setNodes, setEdges])

  // Sync React Flow changes back to store
  const syncToStore = useCallback((nds: Node[], eds: Edge[]) => {
    if (!activeWorkflowId) return
    const wfNodes: WFNode[] = nds.map((n) => ({
      id: n.id,
      type: n.type as WFNode['type'],
      position: n.position,
      data: {
        label: (n.data as Record<string, unknown>).label as string || '',
        prompt: (n.data as Record<string, unknown>).prompt as string || undefined,
        model: (n.data as Record<string, unknown>).model as string || undefined,
        systemPrompt: (n.data as Record<string, unknown>).systemPrompt as string || undefined,
        condition: (n.data as Record<string, unknown>).condition as string || undefined
      }
    }))
    const wfEdges: WFEdge[] = eds.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle as WFEdge['sourceHandle'],
      label: e.label as string || undefined
    }))
    updateWorkflowNodes(activeWorkflowId, wfNodes)
    updateWorkflowEdges(activeWorkflowId, wfEdges)
  }, [activeWorkflowId, updateWorkflowNodes, updateWorkflowEdges])

  const onConnect: OnConnect = useCallback(
    (params) => {
      setEdges((eds) => {
        const updated = addEdge({
          ...params,
          label: params.sourceHandle === 'yes' ? '是' : params.sourceHandle === 'no' ? '否' : undefined
        }, eds)
        setNodes((currentNodes) => {
          syncToStore(currentNodes, updated)
          return currentNodes
        })
        return updated
      })
    },
    [setEdges, setNodes, syncToStore]
  )

  const onNodeClick: NodeMouseHandler = useCallback((_e, node) => {
    setSelectedNodeId(node.id)
  }, [])

  const onNodesChangeWrapped = useCallback((changes: NodeChange[]) => {
    const updatedNodes = applyNodeChanges(changes, nodes)
    setNodes(updatedNodes)
    syncToStore(updatedNodes, edges)
  }, [nodes, edges, setNodes, syncToStore])

  const addNode = useCallback((type: WFNode['type']) => {
    if (!activeWorkflowId) return
    const id = genId(type + '-')
    const positions = {
      start: { x: 250, y: 50 },
      agent: { x: 250, y: 200 },
      condition: { x: 250, y: 350 },
      end: { x: 250, y: 500 }
    }
    const newNode: Node = {
      id,
      type,
      position: { ...positions[type], x: positions[type].x + Math.random() * 80 - 40 },
      data: {
        label: type === 'start' ? '开始' : type === 'end' ? '结束' : type === 'condition' ? '条件' : 'Agent'
      }
    }
    setNodes((nds) => {
      const updated = [...nds, newNode]
      setEdges((currentEdges) => {
        syncToStore(updated, currentEdges)
        return currentEdges
      })
      return updated
    })
  }, [activeWorkflowId, setNodes, setEdges, syncToStore])

  const handleSaveNode = useCallback((nodeId: string, data: WFNode['data']) => {
    setNodes((nds) => {
      const updated = nds.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...data, executionStatus: (n.data as Record<string, unknown>).executionStatus } } : n
      )
      setEdges((currentEdges) => {
        syncToStore(updated, currentEdges)
        return currentEdges
      })
      return updated
    })
    setSelectedNodeId(null)
  }, [setNodes, setEdges, syncToStore])

  const handleDeleteNode = useCallback((nodeId: string) => {
    setNodes((nds) => {
      const updated = nds.filter((n) => n.id !== nodeId)
      setEdges((eds) => {
        const updatedEdges = eds.filter((e) => e.source !== nodeId && e.target !== nodeId)
        syncToStore(updated, updatedEdges)
        return updatedEdges
      })
      return updated
    })
    setSelectedNodeId(null)
  }, [setNodes, setEdges, syncToStore])

  const isExecuting = workflowExecution?.status === 'running'

  // No active workflow — show list
  if (!activeWorkflow) {
    return (
      <div className="flex h-full flex-col">
        <header className="flex items-center justify-between border-b border-border-subtle px-4 py-2">
          <h2 className="text-sm font-medium text-content-heading">工作流</h2>
          <button
            onClick={() => {
              const name = `工作流 ${workflows.length + 1}`
              createWorkflow(name)
            }}
            className="rounded bg-accent px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-accent-hover"
          >
            + 新建工作流
          </button>
        </header>

        {workflows.length === 0 ? (
          <EmptyWorkflowState />
        ) : (
          <div className="flex-1 overflow-y-auto">
            {workflows.map((wf) => (
              <div key={wf.id} className="group flex items-center justify-between border-b border-border-subtle/50 px-4 py-3 hover:bg-surface-elevated/30">
                <button
                  onClick={() => setActiveWorkflow(wf.id)}
                  className="flex-1 text-left"
                >
                  <div className="text-sm font-medium text-content-heading">{wf.name}</div>
                  <div className="mt-0.5 flex gap-3 text-[10px] text-content-subtle">
                    <span>{wf.nodes.length} 节点</span>
                    <span>{wf.edges.length} 连接</span>
                    <span>{new Date(wf.updatedAt).toLocaleDateString('zh-CN')}</span>
                  </div>
                </button>
                <button
                  onClick={() => deleteWorkflow(wf.id)}
                  className="rounded p-1 text-[10px] text-content-subtle opacity-0 transition-opacity group-hover:opacity-100 hover:text-danger"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // Active workflow — show editor
  const wfNode = activeWorkflow.nodes.find((n) => n.id === selectedNodeId)
  const hasStart = activeWorkflow.nodes.some((n) => n.type === 'start')

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-border-subtle px-4 py-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveWorkflow(null)}
            className="rounded px-1 text-xs text-content-subtle hover:text-content-heading"
            title="返回列表"
          >
            ←
          </button>
          <h2 className="text-sm font-medium text-content-heading">{activeWorkflow.name}</h2>
          {workflowExecution && (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
              workflowExecution.status === 'running' ? 'bg-warning-bg text-warning' :
              workflowExecution.status === 'completed' ? 'bg-success-bg text-success' :
              'bg-danger-bg text-danger'
            }`}>
              {workflowExecution.status === 'running' ? '执行中' : workflowExecution.status === 'completed' ? '已完成' : '失败'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {!hasStart && (
            <button
              onClick={() => addNode('start')}
              className="rounded px-2 py-1 text-xs text-success hover:bg-surface-overlay"
            >
              + 开始
            </button>
          )}
          <button onClick={() => addNode('agent')} disabled={isExecuting} className="rounded px-2 py-1 text-xs text-content-subtle hover:bg-surface-overlay hover:text-content-heading disabled:opacity-30">
            + Agent
          </button>
          <button onClick={() => addNode('condition')} disabled={isExecuting} className="rounded px-2 py-1 text-xs text-content-subtle hover:bg-surface-overlay hover:text-content-heading disabled:opacity-30">
            + 条件
          </button>
          <button onClick={() => addNode('end')} disabled={isExecuting} className="rounded px-2 py-1 text-xs text-content-subtle hover:bg-surface-overlay hover:text-content-heading disabled:opacity-30">
            + 结束
          </button>
          <div className="mx-1 h-4 w-px bg-surface-overlay" />
          <WorkflowExecutor workflow={activeWorkflow} />
        </div>
      </header>

      <div className="relative flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChangeWrapped}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          nodeTypes={workflowNodeTypes}
          defaultEdgeOptions={defaultEdgeOptions}
          fitView
          className="bg-surface-base"
          proOptions={{ hideAttribution: true }}
          nodesDraggable={!isExecuting}
        >
          <Controls className="!border-border-default !bg-surface-elevated [&>button]:!border-border-default [&>button]:!bg-surface-overlay [&>button]:!fill-content-muted [&>button:hover]:!bg-surface-inset" />
          <MiniMap
            className="!border-border-default !bg-surface-elevated"
            maskColor="rgba(0,0,0,0.7)"
            nodeColor={(n) => {
              if (n.type === 'start') return 'var(--t-success)'
              if (n.type === 'end') return 'var(--t-danger)'
              if (n.type === 'condition') return 'var(--t-warning)'
              return 'var(--t-accent)'
            }}
          />
          <Background color="var(--t-border-subtle)" gap={20} size={1} />
        </ReactFlow>

        {wfNode && !isExecuting && (
          <WorkflowProperties
            node={wfNode}
            onSave={(data) => handleSaveNode(wfNode.id, data)}
            onClose={() => setSelectedNodeId(null)}
            onDelete={() => handleDeleteNode(wfNode.id)}
          />
        )}
      </div>
    </div>
  )
}

function EmptyWorkflowState() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <div className="mb-3 text-4xl">🔀</div>
        <p className="text-sm font-medium text-content-muted">Agent 工作流引擎</p>
        <p className="mt-2 text-xs text-content-subtle">可视化编排多 Agent 协作流程</p>
        <div className="mt-4 space-y-1 text-[10px] text-content-subtle">
          <p>串联/并联/条件分支</p>
          <p>Agent 间自动传递上下文</p>
          <p>实时监控执行状态</p>
        </div>
      </div>
    </div>
  )
}
