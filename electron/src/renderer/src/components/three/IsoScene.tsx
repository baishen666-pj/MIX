import { useState, useRef, useEffect, useCallback, type JSX } from 'react'
import { useAppStore, type ProjectRoom, type TeamRole } from '../../stores/app'
import type { AgentActivity } from './types'
import { toIso, sortKey, easeInOutCubic } from './IsoEngine'
import { IsoRoom } from './IsoRoom'
import { IsoBossOffice, BOSS_POSITION } from './IsoBossOffice'
import { IsoDesk, IsoMonitor, FurnitureDefs } from './IsoFurniture'
import { IsoCharacter } from './IsoCharacter'
import { ApprovalGlow, ReturnBurst, WalkTrail } from './IsoEffects'
import { AmbientParticles } from './effects/AmbientParticles'
import { AnimTimeContext } from './AnimationContext'
import { PaletteContext } from './PaletteContext'
import { getPalette } from './themeColors'

const ROOM_W = 10, ROOM_D = 8, ROOM_GAP = 4
const ROLE_COLORS: Record<string, string> = {
  boss: '#4F46E5', pm: '#F59E0B', developer: '#10B981',
  designer: '#EC4899', tester: '#3B82F6', worker: '#8B5CF6'
}

interface MemberState {
  id: string; name: string; role: TeamRole; color: string
  activity: AgentActivity
  worldX: number; worldZ: number
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
      const wx = cx - 2.5 + mcol * 2.5
      const wz = cz - 1.5 + mrow * 2
      members.push({
        id: m.id, name: m.name, role: m.role,
        color: ROLE_COLORS[m.role] || '#8B5CF6',
        activity: m.activity,
        worldX: wx, worldZ: wz,
        facing: 'right',
        walking: null,
        deskX: wx, deskZ: wz,
        trail: []
      })
    })
  })
  return members
}

export function IsoScene() {
  const projectRooms = useAppStore((s) => s.projectRooms)
  const approvalRequests = useAppStore((s) => s.approvalRequests)
  const theme = useAppStore((s) => s.theme)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [returnEffect, setReturnEffect] = useState<{ memberId: string; approved: boolean } | null>(null)
  const animTimeRef = useRef(0)
  const [, setRenderTick] = useState(0)
  const frameCountRef = useRef(0)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })

  const membersRef = useRef<MemberState[]>([])
  const bossRef = useRef<MemberState>({
    id: 'boss', name: '老板', role: 'boss', color: '#4F46E5',
    activity: 'idle', worldX: BOSS_POSITION.x, worldZ: BOSS_POSITION.z,
    facing: 'right', walking: null, deskX: BOSS_POSITION.x, deskZ: BOSS_POSITION.z, trail: []
  })
  const lastCycleRef = useRef(0)
  const lastRespondedIdRef = useRef<string | null>(null)
  const panRef = useRef({ dragging: false, startX: 0, startY: 0 })

  const pendingApproval = approvalRequests.find((r) => r.status === 'pending')

  const initialMembers = buildMembers(projectRooms)
  if (membersRef.current.length !== initialMembers.length) {
    membersRef.current = initialMembers.map((m) => ({ ...m }))
  }

  // rAF animation loop
  useEffect(() => {
    let running = true
    let prev = performance.now()
    const loop = (now: number) => {
      if (!running) return
      const delta = (now - prev) / 1000
      prev = now
      animTimeRef.current += delta

      // Render at ~10fps instead of 60fps to avoid thrashing React
      frameCountRef.current++
      if (frameCountRef.current % 6 === 0) {
        setRenderTick((t) => t + 1)
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

      // Trigger submission walk
      if (pendingApproval) {
        const submitter = allMembers.find((m) => m.id === pendingApproval.fromMemberId)
        if (submitter && !submitter.walking && submitter.activity !== 'submitting') {
          submitter.trail = []
          submitter.walking = {
            fromX: submitter.worldX, fromZ: submitter.worldZ,
            toX: BOSS_POSITION.x + 1, toZ: BOSS_POSITION.z + 0.5,
            progress: 0, speed: 0.35, targetActivity: 'submitting'
          }
          submitter.activity = 'walking'
        }
      }

      // Detect approval response → return walk
      const responded = approvalRequests.find(
        (r) => r.status !== 'pending' && r.id !== lastRespondedIdRef.current
      )
      if (responded) {
        lastRespondedIdRef.current = responded.id
        const returner = allMembers.find((m) => m.id === responded.fromMemberId)
        if (returner && !returner.walking) {
          returner.trail = []
          returner.walking = {
            fromX: returner.worldX, fromZ: returner.worldZ,
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
        agent.worldX = w.fromX + (w.toX - w.fromX) * eased
        agent.worldZ = w.fromZ + (w.toZ - w.fromZ) * eased

        // Trail
        if (agent.trail.length === 0 || Math.abs(agent.worldX - agent.trail[0].x) > 0.3) {
          agent.trail = [{ x: agent.worldX, z: agent.worldZ }, ...agent.trail].slice(0, 5)
        }

        // Facing
        const dx = w.toX - w.fromX
        agent.facing = dx >= 0 ? 'right' : 'left'

        if (w.progress >= 1) {
          agent.worldX = w.toX; agent.worldZ = w.toZ
          agent.activity = w.targetActivity
          agent.walking = null
          if (returnEffect && returnEffect.memberId === agent.id) {
            setTimeout(() => setReturnEffect(null), 800)
          }
        }
      }

      requestAnimationFrame(loop)
    }
    requestAnimationFrame(loop)
    return () => { running = false }
  }, [pendingApproval, approvalRequests, returnEffect])

  // Zoom handler
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    setZoom((z) => Math.max(0.3, Math.min(3, z - e.deltaY * 0.001)))
  }, [])

  // Pan handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    panRef.current = { dragging: true, startX: e.clientX - pan.x, startY: e.clientY - pan.y }
  }, [pan])
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!panRef.current.dragging) return
    setPan({ x: e.clientX - panRef.current.startX, y: e.clientY - panRef.current.startY })
  }, [])
  const handleMouseUp = useCallback(() => { panRef.current.dragging = false }, [])

  const allMembers = [bossRef.current, ...membersRef.current]

  // Compute viewBox to fit all rooms + boss office
  const roomCount = projectRooms.length
  const totalWidth = Math.max(30, Math.ceil(roomCount / 2) * (ROOM_W + ROOM_GAP) + 20)
  const totalHeight = Math.max(25, Math.ceil(roomCount / 2 + 1) * (ROOM_D + ROOM_GAP) + 15)

  // Build sorted render list
  const renderItems: { type: 'room' | 'boss' | 'member' | 'effect'; sortKey: number; element: JSX.Element }[] = []

  // Boss office
  renderItems.push({ type: 'boss', sortKey: sortKey(BOSS_POSITION.x, 0, BOSS_POSITION.z), element: <IsoBossOffice key="boss" /> })
  renderItems.push({ type: 'effect', sortKey: sortKey(BOSS_POSITION.x, 0, BOSS_POSITION.z) + 0.5, element: <AmbientParticles key="boss-particles" cx={0} cz={-8} width={12} depth={10} /> })

  // Rooms
  projectRooms.forEach((room, ri) => {
    const col = ri % 2
    const row = Math.floor(ri / 2)
    const cx = col * (ROOM_W + ROOM_GAP) + 6
    const cz = row * (ROOM_D + ROOM_GAP) + 4

    renderItems.push({
      type: 'room', sortKey: sortKey(cx, 0, cz),
      element: (
        <IsoRoom key={room.id} cx={cx} cz={cz} width={ROOM_W} depth={ROOM_D}
          label={`${room.name} (${room.members.length}人)`} />
      )
    })
    renderItems.push({
      type: 'effect', sortKey: sortKey(cx, 0, cz) + 0.5,
      element: <AmbientParticles key={`particles-${room.id}`} cx={cx} cz={cz} width={ROOM_W} depth={ROOM_D} />
    })

    // Furniture in each room
    room.members.forEach((m, mi) => {
      const mcol = mi % 3
      const mrow = Math.floor(mi / 3)
      const fx = cx - 2.5 + mcol * 2.5
      const fz = cz - 2 + mrow * 2
      const sk = sortKey(fx, 0, fz)
      renderItems.push({ type: 'member', sortKey: sk, element: <IsoDesk key={`desk-${m.id}`} x={fx} z={fz} /> })
      renderItems.push({ type: 'member', sortKey: sk + 0.1, element: <IsoMonitor key={`mon-${m.id}`} x={fx} z={fz - 0.5} /> })
    })
  })

  // Members (characters)
  for (const m of allMembers) {
    const pos = toIso(m.worldX, m.worldZ)
    renderItems.push({
      type: 'member', sortKey: sortKey(m.worldX, 1, m.worldZ),
      element: (
        <g key={m.id} transform={`translate(${pos.x},${pos.y})`}>
          <WalkTrail positions={m.trail} />
          <IsoCharacter
            name={m.name} role={m.role} color={m.color}
            activity={m.activity} facing={m.facing}
            isWalking={!!m.walking}
            onClick={() => setSelectedId(m.id)}
          />
        </g>
      )
    })
  }

  // Effects
  if (pendingApproval) {
    renderItems.push({ type: 'effect', sortKey: 0, element: <ApprovalGlow key="glow" cx={BOSS_POSITION.x} cz={BOSS_POSITION.z} /> })
  }

  if (returnEffect) {
    const member = allMembers.find((m) => m.id === returnEffect.memberId)
    if (member) {
      renderItems.push({ type: 'effect', sortKey: 0, element: <ReturnBurst key="burst" x={member.worldX} z={member.worldZ} approved={returnEffect.approved} /> })
    }
  }

  renderItems.sort((a, b) => a.sortKey - b.sortKey)

  const bgColor = 'var(--t-surface-base)'
  const palette = getPalette(theme)

  return (
    <div className="h-full w-full overflow-hidden" style={{ background: bgColor }}>
      <AnimTimeContext.Provider value={animTimeRef}>
      <PaletteContext.Provider value={{ palette, theme }}>
      <svg
        width="100%" height="100%"
        viewBox={`${-totalWidth * 25} ${-totalHeight * 25} ${totalWidth * 50} ${totalHeight * 50}`}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: panRef.current.dragging ? 'grabbing' : 'grab' }}
      >
        <FurnitureDefs />
        <g transform={`translate(${pan.x / zoom},${pan.y / zoom}) scale(${zoom})`}>
          {renderItems.map((item, i) => <g key={i}>{item.element}</g>)}
        </g>
      </svg>
      </PaletteContext.Provider>
      </AnimTimeContext.Provider>

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
