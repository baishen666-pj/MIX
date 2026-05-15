import { useState, useRef, useEffect, useCallback } from 'react'
import { useAppStore, type ProjectRoom, type TeamRole } from '../../stores/app'
import type { AgentActivity } from './types'
import { toScreen, screenToGrid, sortKey, easeInOutCubic, roomRect, clamp } from './PixelEngine'
import { drawRoom, drawFurniture, drawCharacter, drawNameLabel, drawApprovalGlow, drawWalkTrail } from './PixelRenderer'
import { getPalette } from './themeColors'

const ROOM_W = 10, ROOM_D = 8, ROOM_GAP = 4
const SPRITE_SCALE = 2
const CHAR_SIZE = 16 * SPRITE_SCALE
const ROLE_COLORS: Record<string, string> = {
  boss: '#4F46E5', pm: '#F59E0B', developer: '#10B981',
  designer: '#EC4899', tester: '#3B82F6', worker: '#8B5CF6'
}
const BOSS_CX = 0, BOSS_CZ = -8, BOSS_W = 12, BOSS_D = 10

interface MemberState {
  id: string; name: string; role: TeamRole; color: string
  activity: AgentActivity
  gridX: number; gridZ: number
  facing: 'left' | 'right'
  walking: { fromX: number; fromZ: number; toX: number; toZ: number; progress: number; speed: number; targetActivity: AgentActivity } | null
  deskX: number; deskZ: number
  trail: { x: number; z: number }[]
}

function buildMembers(rooms: ProjectRoom[]): MemberState[] {
  const members: MemberState[] = []
  rooms.forEach((room, ri) => {
    const col = ri % 2
    const row = Math.floor(ri / 2)
    const cx = col * (ROOM_W + ROOM_GAP) + 6
    const cz = row * (ROOM_D + ROOM_GAP) + 4

    room.members.forEach((m, mi) => {
      const mcol = mi % 3
      const mrow = Math.floor(mi / 3)
      const gx = cx - 2.5 + mcol * 2.5
      const gz = cz - 1.5 + mrow * 2
      members.push({
        id: m.id, name: m.name, role: m.role,
        color: ROLE_COLORS[m.role] || '#8B5CF6',
        activity: m.activity,
        gridX: gx, gridZ: gz,
        facing: 'right',
        walking: null,
        deskX: gx, deskZ: gz,
        trail: []
      })
    })
  })
  return members
}

export function PixelScene() {
  const projectRooms = useAppStore((s) => s.projectRooms)
  const approvalRequests = useAppStore((s) => s.approvalRequests)
  const theme = useAppStore((s) => s.theme)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [returnEffect, setReturnEffect] = useState<{ memberId: string; approved: boolean } | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animTimeRef = useRef(0)
  const frameCountRef = useRef(0)
  const animFrameRef = useRef(0)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })

  const membersRef = useRef<MemberState[]>([])
  const bossRef = useRef<MemberState>({
    id: 'boss', name: '老板', role: 'boss', color: '#4F46E5',
    activity: 'idle', gridX: BOSS_CX, gridZ: BOSS_CZ,
    facing: 'right', walking: null, deskX: BOSS_CX, deskZ: BOSS_CZ, trail: []
  })
  const lastCycleRef = useRef(0)
  const lastRespondedIdRef = useRef<string | null>(null)
  const panRef = useRef({ dragging: false, startX: 0, startY: 0 })
  const pendingApproval = approvalRequests.find((r) => r.status === 'pending')

  const initialMembers = buildMembers(projectRooms)
  if (membersRef.current.length !== initialMembers.length) {
    membersRef.current = initialMembers.map((m) => ({ ...m }))
  }

  // Canvas size
  const canvasW = 1200
  const canvasH = 800

  // Animation loop
  useEffect(() => {
    let running = true
    let prev = performance.now()
    const loop = (now: number) => {
      if (!running) return
      const delta = (now - prev) / 1000
      prev = now
      animTimeRef.current += delta

      frameCountRef.current++
      if (frameCountRef.current % 6 === 0) {
        animFrameRef.current = (animFrameRef.current + 1) % 4
      }

      const members = membersRef.current
      const allMembers = [bossRef.current, ...members]

      // Activity cycling
      const t = now / 1000
      if (t - lastCycleRef.current > 8 && allMembers.length > 1) {
        lastCycleRef.current = t
        const idx = Math.floor(Math.random() * allMembers.length)
        const agent = allMembers[idx]
        if (!agent.walking && agent.activity !== 'submitting') {
          const activities: AgentActivity[] = ['idle', 'working', 'meeting']
          agent.activity = activities[Math.floor(Math.random() * activities.length)]
        }
      }

      // Approval walk
      if (pendingApproval) {
        const submitter = allMembers.find((m) => m.id === pendingApproval.fromMemberId)
        if (submitter && !submitter.walking && submitter.activity !== 'submitting') {
          submitter.trail = []
          submitter.walking = {
            fromX: submitter.gridX, fromZ: submitter.gridZ,
            toX: BOSS_CX + 1, toZ: BOSS_CZ + 0.5,
            progress: 0, speed: 0.35, targetActivity: 'submitting'
          }
          submitter.activity = 'walking'
        }
      }

      // Return walk
      const responded = approvalRequests.find(
        (r) => r.status !== 'pending' && r.id !== lastRespondedIdRef.current
      )
      if (responded) {
        lastRespondedIdRef.current = responded.id
        const returner = allMembers.find((m) => m.id === responded.fromMemberId)
        if (returner && !returner.walking) {
          returner.trail = []
          returner.walking = {
            fromX: returner.gridX, fromZ: returner.gridZ,
            toX: returner.deskX, toZ: returner.deskZ,
            progress: 0, speed: 0.35,
            targetActivity: responded.status === 'approved' ? 'working' : 'idle'
          }
          returner.activity = 'walking'
          setReturnEffect({ memberId: returner.id, approved: responded.status === 'approved' })
        }
      }

      // Advance walking
      for (const agent of allMembers) {
        if (!agent.walking) continue
        const w = agent.walking
        w.progress += delta * w.speed
        const eased = easeInOutCubic(Math.min(w.progress, 1))
        agent.gridX = w.fromX + (w.toX - w.fromX) * eased
        agent.gridZ = w.fromZ + (w.toZ - w.fromZ) * eased

        if (agent.trail.length === 0 || Math.abs(agent.gridX - agent.trail[0].x) > 0.3) {
          agent.trail = [{ x: agent.gridX, z: agent.gridZ }, ...agent.trail].slice(0, 5)
        }

        const dx = w.toX - w.fromX
        agent.facing = dx >= 0 ? 'right' : 'left'

        if (w.progress >= 1) {
          agent.gridX = w.toX; agent.gridZ = w.toZ
          agent.activity = w.targetActivity
          agent.walking = null
          if (returnEffect && returnEffect.memberId === agent.id) {
            setTimeout(() => setReturnEffect(null), 800)
          }
        }
      }

      // Render
      const canvas = canvasRef.current
      if (!canvas) { requestAnimationFrame(loop); return }
      const ctx = canvas.getContext('2d')
      if (!ctx) { requestAnimationFrame(loop); return }

      const palette = getPalette(theme)

      ctx.imageSmoothingEnabled = false
      ctx.clearRect(0, 0, canvasW, canvasH)

      ctx.save()
      ctx.translate(pan.x + canvasW / 2, pan.y + canvasH / 2)
      ctx.scale(zoom, zoom)

      const px = (gx: number) => gx * 32
      const py = (gz: number) => gz * 32

      // Boss room
      const bossRect = roomRect(BOSS_CX, BOSS_CZ, BOSS_W, BOSS_D)
      drawRoom(ctx, bossRect, '老板办公室', palette, 'tile')
      // Boss desk
      drawFurniture(ctx, px(BOSS_CX) - 16, py(BOSS_CZ - 2) - 8, 'desk', palette, SPRITE_SCALE)
      drawFurniture(ctx, px(BOSS_CX) - 4, py(BOSS_CZ - 2.5) - 8, 'monitor', palette, SPRITE_SCALE)
      drawFurniture(ctx, px(BOSS_CX + 4), py(BOSS_CZ + 3) - 8, 'plant', palette, SPRITE_SCALE)
      drawFurniture(ctx, px(BOSS_CX - 4), py(BOSS_CZ + 3) - 8, 'plant', palette, SPRITE_SCALE)

      // Project rooms
      projectRooms.forEach((room, ri) => {
        const col = ri % 2
        const row = Math.floor(ri / 2)
        const cx = col * (ROOM_W + ROOM_GAP) + 6
        const cz = row * (ROOM_D + ROOM_GAP) + 4
        const rect = roomRect(cx, cz, ROOM_W, ROOM_D)
        drawRoom(ctx, rect, `${room.name} (${room.members.length}人)`, palette)

        room.members.forEach((m, mi) => {
          const mcol = mi % 3
          const mrow = Math.floor(mi / 3)
          const fx = cx - 2.5 + mcol * 2.5
          const fz = cz - 2 + mrow * 2
          drawFurniture(ctx, px(fx) - 16, py(fz) - 8, 'desk', palette, SPRITE_SCALE)
          drawFurniture(ctx, px(fx) - 4, py(fz - 0.5) - 8, 'monitor', palette, SPRITE_SCALE)
        })
      })

      // Approval glow
      if (pendingApproval) {
        drawApprovalGlow(ctx, px(BOSS_CX), py(BOSS_CZ), animTimeRef.current, palette)
      }

      // Characters (sorted by z)
      const allSorted = [...membersRef.current, bossRef.current]
      allSorted.sort((a, b) => sortKey(a.gridX, a.gridZ) - sortKey(b.gridX, b.gridZ))

      for (const m of allSorted) {
        const sx = px(m.gridX) - CHAR_SIZE / 2
        const sy = py(m.gridZ) - CHAR_SIZE

        // Walk trail
        if (m.trail.length > 0) {
          const trailPx = m.trail.map((p) => ({ x: px(p.x), z: py(p.z) }))
          drawWalkTrail(ctx, trailPx, palette)
        }

        drawCharacter(ctx, sx, sy, m.role, m.activity, animFrameRef.current, palette, SPRITE_SCALE)
        drawNameLabel(ctx, sx + CHAR_SIZE / 2, sy + CHAR_SIZE + 4, m.name, m.color, selectedId === m.id)
      }

      ctx.restore()

      requestAnimationFrame(loop)
    }
    requestAnimationFrame(loop)
    return () => { running = false }
  }, [projectRooms, pendingApproval, approvalRequests, returnEffect, theme, zoom, pan, selectedId])

  // Zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    setZoom((z) => clamp(z - e.deltaY * 0.001, 0.5, 3))
  }, [])

  // Pan
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    panRef.current = { dragging: true, startX: e.clientX - pan.x, startY: e.clientY - pan.y }
  }, [pan])
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!panRef.current.dragging) return
    setPan({ x: e.clientX - panRef.current.startX, y: e.clientY - panRef.current.startY })
  }, [])
  const handleMouseUp = useCallback(() => { panRef.current.dragging = false }, [])

  // Click → select character
  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const clickX = (e.clientX - rect.left - pan.x - canvasW / 2) / zoom
    const clickZ = (e.clientY - rect.top - pan.y - canvasH / 2) / zoom
    const grid = screenToGrid(clickX / 32, clickZ / 32)

    const allMembers = [bossRef.current, ...membersRef.current]
    let closest: MemberState | null = null
    let closestDist = Infinity
    for (const m of allMembers) {
      const dx = m.gridX - grid.x
      const dz = m.gridZ - grid.z
      const dist = dx * dx + dz * dz
      if (dist < closestDist && dist < 2) {
        closest = m
        closestDist = dist
      }
    }
    setSelectedId(closest?.id ?? null)
  }, [zoom, pan])

  const palette = getPalette(theme)
  const allMembers = [bossRef.current, ...membersRef.current]

  return (
    <div className="h-full w-full overflow-hidden" style={{ background: 'var(--t-surface-base)' }}>
      <canvas
        ref={canvasRef}
        width={canvasW}
        height={canvasH}
        style={{
          width: '100%',
          height: '100%',
          imageRendering: 'pixelated',
          cursor: panRef.current.dragging ? 'grabbing' : 'grab',
        }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleClick}
      />

      {/* Info panel */}
      {selectedId && (() => {
        const member = allMembers.find((m) => m.id === selectedId)
        if (!member) return null
        const activityLabel: Record<string, string> = { idle: '空闲', working: '工作中', meeting: '会议中', walking: '行走中', submitting: '提交中' }
        return (
          <div className="animate-slide-up absolute right-4 top-4 rounded-lg border border-border-default bg-surface-elevated px-3 py-2 shadow-lg">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full" style={{ background: member.color }} />
              <span className="text-sm font-medium text-content-heading">{member.name}</span>
              <span className="text-[10px] text-content-subtle">{member.role}</span>
            </div>
            <div className="mt-1 text-xs text-content-muted">状态: {activityLabel[member.activity] || member.activity}</div>
            <button onClick={() => setSelectedId(null)} className="mt-1 rounded px-1 text-[10px] text-content-subtle hover:bg-surface-overlay hover:text-content-heading">关闭</button>
          </div>
        )
      })()}
    </div>
  )
}
