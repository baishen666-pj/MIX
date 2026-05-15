import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import type { LayoutItem } from './types'
import { FURNITURE_META } from './constants'

type LayoutNodeData = LayoutItem & { selected?: boolean }

export function LayoutNode({ data, selected }: NodeProps & { data: LayoutNodeData }) {
  const meta = FURNITURE_META[data.type]
  if (!meta) return null

  return (
    <div
      style={{
        width: meta.width * 40,
        height: meta.depth * 40,
        backgroundColor: meta.color,
        border: selected ? '2px solid var(--t-accent-text)' : '1px solid var(--t-border-default)',
        borderRadius: data.type === 'roundTable' ? '50%' : data.type === 'plant' ? '50%' : '4px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '9px',
        color: 'var(--t-content-muted)',
        cursor: 'grab',
        position: 'relative',
        transform: `rotate(${data.rotation}rad)`,
        transition: 'border-color 0.15s'
      }}
    >
      {meta.label}
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  )
}
