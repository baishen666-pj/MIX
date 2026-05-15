import { genId } from '../../lib/genId'
import { useState, useCallback, useMemo } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type Node,
  type Edge,
  BackgroundVariant
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { LayoutNode } from './LayoutNode'
import { useAppStore } from '../../stores/app'
import { FURNITURE_META, FLOOR_WIDTH, FLOOR_DEPTH } from './constants'
import type { FurnitureType, LayoutItem } from './types'

const nodeTypes = { layout: LayoutNode }

const PALETTE: FurnitureType[] = ['desk', 'chair', 'roundTable', 'sofa', 'plant', 'coffeeTable']

interface LayoutEditorProps {
  onSave: () => void
  onCancel: () => void
}

export function LayoutEditor({ onSave, onCancel }: LayoutEditorProps) {
  const officeLayout = useAppStore((s) => s.officeLayout)
  const setOfficeLayout = useAppStore((s) => s.setOfficeLayout)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const initialNodes: Node[] = useMemo(
    () => officeLayout.map((item) => ({
      id: item.id,
      type: 'layout',
      position: { x: item.x * 40 + FLOOR_WIDTH * 20, y: item.z * 40 + FLOOR_DEPTH * 20 },
      data: { ...item, selected: false }
    })),
    [officeLayout]
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState([] as Edge[])

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  )

  const handleAdd = useCallback((type: FurnitureType) => {
    const id = genId(type + '-')
    const newNode: Node = {
      id,
      type: 'layout',
      position: { x: FLOOR_WIDTH * 20, y: FLOOR_DEPTH * 20 },
      data: { id, type, x: 0, z: 0, rotation: 0 }
    }
    setNodes((nds) => [...nds, newNode])
  }, [setNodes])

  const handleDelete = useCallback(() => {
    if (!selectedId) return
    setNodes((nds) => nds.filter((n) => n.id !== selectedId))
    setSelectedId(null)
  }, [selectedId, setNodes])

  const handleRotate = useCallback(() => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === selectedId
          ? { ...n, data: { ...n.data, rotation: ((n.data.rotation as number) + Math.PI / 2) % (Math.PI * 2) } }
          : n
      )
    )
  }, [selectedId, setNodes])

  const handleSave = useCallback(() => {
    const items: LayoutItem[] = nodes.map((n) => ({
      id: n.id,
      type: n.data.type as FurnitureType,
      x: (n.position.x - FLOOR_WIDTH * 20) / 40,
      z: (n.position.y - FLOOR_DEPTH * 20) / 40,
      rotation: (n.data.rotation as number) ?? 0
    }))
    setOfficeLayout(items)
    onSave()
  }, [nodes, setOfficeLayout, onSave])

  return (
    <div className="flex h-full">
      {/* Palette sidebar */}
      <div className="flex w-44 flex-col gap-2 border-r border-border-subtle bg-surface-base p-3">
        <div className="mb-1 text-xs font-medium text-content-muted">家具</div>
        {PALETTE.map((type) => (
          <button
            key={type}
            onClick={() => handleAdd(type)}
            className="flex items-center gap-2 rounded-lg border border-border-subtle bg-surface-elevated px-3 py-2 text-xs text-content-heading transition-colors hover:border-border-default hover:bg-surface-overlay"
          >
            <span
              className="inline-block h-3 w-3 rounded"
              style={{ backgroundColor: FURNITURE_META[type].color }}
            />
            {FURNITURE_META[type].label}
          </button>
        ))}

        <div className="my-2 border-t border-border-subtle" />

        <div className="text-xs font-medium text-content-muted">操作</div>
        <button
          onClick={handleRotate}
          disabled={!selectedId}
          className="rounded-lg border border-border-subtle bg-surface-elevated px-3 py-2 text-xs text-content-heading transition-colors hover:bg-surface-overlay disabled:opacity-40"
        >
          旋转 (+90°)
        </button>
        <button
          onClick={handleDelete}
          disabled={!selectedId}
          className="rounded-lg border border-danger/30 bg-surface-elevated px-3 py-2 text-xs text-danger transition-colors hover:bg-danger/10 disabled:opacity-40"
        >
          删除
        </button>

        <div className="mt-auto flex flex-col gap-2">
          <button
            onClick={handleSave}
            className="rounded-lg bg-accent px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-accent-hover"
          >
            保存布局
          </button>
          <button
            onClick={onCancel}
            className="rounded-lg border border-border-default bg-surface-elevated px-3 py-2 text-xs text-content-muted transition-colors hover:bg-surface-overlay"
          >
            取消
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={(_, n) => setSelectedId(n.id)}
          onPaneClick={() => setSelectedId(null)}
          nodeTypes={nodeTypes}
          fitView
          snapToGrid
          snapGrid={[10, 10]}
          minZoom={0.3}
          maxZoom={2}
          style={{ backgroundColor: 'var(--t-surface-elevated)' }}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Lines} color="var(--t-border-subtle)" gap={40} />
          <Controls
            showInteractive={false}
            style={{ background: 'var(--t-surface-overlay)', borderRadius: 8 }}
          />
        </ReactFlow>
      </div>
    </div>
  )
}
