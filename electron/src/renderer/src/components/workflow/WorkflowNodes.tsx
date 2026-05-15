import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { WorkflowNode } from '../../../../shared/types'

type WFNodeData = WorkflowNode['data'] & { executionStatus?: string }

const STATUS_COLORS: Record<string, string> = {
  idle: 'border-border-default bg-surface-elevated',
  running: 'border-warning bg-warning-bg shadow-[0_0_8px_var(--t-warning)]',
  completed: 'border-success bg-success-bg',
  failed: 'border-danger bg-danger-bg',
  skipped: 'border-border-default bg-surface-elevated/50'
}

export const StartNode = memo(({ data }: NodeProps) => {
  return (
    <div className={`flex h-10 min-w-[100px] items-center justify-center rounded-lg border-2 border-success bg-success-bg px-4 text-xs font-medium text-success`}>
      <Handle type="source" position={Position.Bottom} className="!bg-success !border-success/50 !w-2 !h-2" />
      {(data as WFNodeData).label || '开始'}
    </div>
  )
})
StartNode.displayName = 'StartNode'

export const AgentWorkflowNode = memo(({ data, selected }: NodeProps) => {
  const d = data as WFNodeData
  const status = d.executionStatus || 'idle'
  const statusColor = STATUS_COLORS[status] || STATUS_COLORS.idle

  return (
    <div className={`min-w-[160px] rounded-lg border-2 px-3 py-2 transition-all ${statusColor} ${selected ? 'ring-1 ring-accent' : ''}`}>
      <Handle type="target" position={Position.Top} className="!bg-content-subtle !border-border-default !w-2 !h-2" />

      <div className="flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded bg-accent/20 text-[10px] text-accent-text">
          AI
        </span>
        <span className="text-xs font-medium text-content-secondary">{d.label || '智能体'}</span>
        {status === 'running' && (
          <span className="ml-auto h-2 w-2 animate-pulse rounded-full bg-warning" />
        )}
      </div>

      {d.model && (
        <div className="mt-1 text-[10px] text-content-subtle">{d.model}</div>
      )}

      {d.prompt && (
        <div className="mt-1 line-clamp-2 text-[10px] leading-tight text-content-subtle">
          {d.prompt}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} className="!bg-content-subtle !border-border-default !w-2 !h-2" />
    </div>
  )
})
AgentWorkflowNode.displayName = 'AgentWorkflowNode'

export const ConditionNode = memo(({ data, selected }: NodeProps) => {
  const d = data as WFNodeData
  const status = d.executionStatus || 'idle'
  const statusColor = STATUS_COLORS[status] || STATUS_COLORS.idle

  return (
    <div className={`min-w-[140px] rounded-lg border-2 px-3 py-2 transition-all ${statusColor} ${selected ? 'ring-1 ring-accent' : ''}`}>
      <Handle type="target" position={Position.Top} className="!bg-content-subtle !border-border-default !w-2 !h-2" />

      <div className="flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded bg-warning-bg text-[10px] text-warning">
          ?
        </span>
        <span className="text-xs font-medium text-content-secondary">{d.label || '条件'}</span>
      </div>

      {d.condition && (
        <div className="mt-1 text-[10px] text-content-subtle">{d.condition}</div>
      )}

      <Handle
        type="source" position={Position.Bottom} id="yes"
        className="!bg-success !border-success/50 !w-2 !h-2"
        style={{ left: '30%' }}
      />
      <Handle
        type="source" position={Position.Bottom} id="no"
        className="!bg-danger !border-danger/50 !w-2 !h-2"
        style={{ left: '70%' }}
      />

      <div className="mt-1 flex justify-between px-1 text-[9px]">
        <span className="text-success">是</span>
        <span className="text-danger">否</span>
      </div>
    </div>
  )
})
ConditionNode.displayName = 'ConditionNode'

export const EndNode = memo(({ data }: NodeProps) => {
  return (
    <div className="flex h-10 min-w-[100px] items-center justify-center rounded-lg border-2 border-danger bg-danger-bg px-4 text-xs font-medium text-danger">
      <Handle type="target" position={Position.Top} className="!bg-danger !border-danger/50 !w-2 !h-2" />
      {(data as WFNodeData).label || '结束'}
    </div>
  )
})
EndNode.displayName = 'EndNode'

export const workflowNodeTypes = {
  start: StartNode,
  agent: AgentWorkflowNode,
  condition: ConditionNode,
  end: EndNode
}
