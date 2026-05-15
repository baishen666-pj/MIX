import { useState, useCallback } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { LayoutEditor } from './LayoutEditor'
import { PixelScene } from './PixelScene'
import { useAppStore } from '../../stores/app'

export function AgentGraph3D() {
  const [editMode, setEditMode] = useState(false)
  const [roomName, setRoomName] = useState('')
  const [addingRoom, setAddingRoom] = useState(false)
  const projectRooms = useAppStore((s) => s.projectRooms)
  const addProjectRoom = useAppStore((s) => s.addProjectRoom)

  const handleAddRoom = useCallback(() => {
    if (!roomName.trim()) return
    addProjectRoom(roomName.trim())
    setRoomName('')
    setAddingRoom(false)
  }, [roomName, addProjectRoom])

  if (editMode) {
    return (
      <div className="flex h-full flex-col">
        <header className="flex items-center justify-between border-b border-border-subtle px-4 py-2">
          <h2 className="text-sm font-medium text-content-heading">布局编辑器</h2>
          <span className="text-xs text-content-subtle">拖拽移动 · 右侧添加家具 · 保存后生效</span>
        </header>
        <div className="flex-1">
          <ReactFlowProvider>
            <LayoutEditor
              onSave={() => setEditMode(false)}
              onCancel={() => setEditMode(false)}
            />
          </ReactFlowProvider>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col relative">
      <header className="flex items-center justify-between border-b border-border-subtle px-4 py-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-medium text-content-heading">虚拟办公室</h2>
          {projectRooms.length > 0 && (
            <span className="rounded-full bg-success-bg px-2 py-0.5 text-[10px] text-success">
              {projectRooms.length} 个项目组
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-content-subtle">滚轮缩放 · 拖拽平移</span>

          {addingRoom ? (
            <div className="flex items-center gap-1">
              <input
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddRoom()}
                placeholder="项目组名称..."
                className="w-28 rounded border border-accent bg-surface-overlay px-2 py-1 text-xs text-content-heading outline-none"
                autoFocus
              />
              <button onClick={handleAddRoom} className="rounded bg-accent px-2 py-1 text-xs text-white">添加</button>
              <button onClick={() => setAddingRoom(false)} className="rounded px-2 py-1 text-xs text-content-subtle hover:bg-surface-overlay">取消</button>
            </div>
          ) : (
            <button
              onClick={() => setAddingRoom(true)}
              className="rounded-md border border-border-default bg-surface-overlay px-2.5 py-1 text-xs text-content-heading transition-colors hover:bg-surface-inset"
            >
              + 项目组
            </button>
          )}

          <button
            onClick={() => setEditMode(true)}
            className="rounded-md border border-border-default bg-surface-overlay px-2.5 py-1 text-xs text-content-heading transition-colors hover:bg-surface-inset"
          >
            编辑布局
          </button>
        </div>
      </header>

      <div className="flex-1">
        <PixelScene />
      </div>
    </div>
  )
}
