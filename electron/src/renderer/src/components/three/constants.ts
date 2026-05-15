import type { DemoAgentConfig, OfficePosition, LayoutItem, FurnitureType } from './types'

// Demo agents shown when canvasAgents is empty
export const DEMO_AGENTS: DemoAgentConfig[] = [
  { id: 'supervisor', name: 'Supervisor', color: '#f59e0b', role: '协调者', activity: 'idle' },
  { id: 'researcher', name: 'Researcher', color: '#6366f1', role: '研究员', activity: 'working' },
  { id: 'coder', name: 'Coder', color: '#10b981', role: '程序员', activity: 'working' },
  { id: 'tester', name: 'Tester', color: '#ec4899', role: '测试员', activity: 'meeting' },
  { id: 'writer', name: 'Writer', color: '#8b5cf6', role: '文档', activity: 'idle' },
  { id: 'reviewer', name: 'Reviewer', color: '#3b82f6', role: '审查员', activity: 'meeting' }
]

// Furniture metadata for the editor palette
export const FURNITURE_META: Record<FurnitureType, { label: string; color: string; width: number; depth: number }> = {
  desk: { label: '桌子', color: '#3f3f46', width: 1.2, depth: 0.6 },
  monitor: { label: '显示器', color: '#27272a', width: 0.6, depth: 0.04 },
  chair: { label: '椅子', color: '#4b5563', width: 0.45, depth: 0.4 },
  roundTable: { label: '圆桌', color: '#44403c', width: 2.0, depth: 2.0 },
  sofa: { label: '沙发', color: '#57534e', width: 1.8, depth: 0.8 },
  plant: { label: '盆栽', color: '#166534', width: 0.3, depth: 0.3 },
  coffeeTable: { label: '茶几', color: '#44403c', width: 1.0, depth: 0.5 }
}

// Default layout — mirrors the original hardcoded furniture positions
export const DEFAULT_LAYOUT: LayoutItem[] = [
  // Workstation row 1 (z=-2.5, facing back wall)
  { id: 'desk-0', type: 'desk', x: -4, z: -2.5, rotation: 0 },
  { id: 'monitor-0', type: 'monitor', x: -4, z: -2.65, rotation: 0 },
  { id: 'chair-0', type: 'chair', x: -4, z: -1.8, rotation: Math.PI },

  { id: 'desk-1', type: 'desk', x: 0, z: -2.5, rotation: 0 },
  { id: 'monitor-1', type: 'monitor', x: 0, z: -2.65, rotation: 0 },
  { id: 'chair-1', type: 'chair', x: 0, z: -1.8, rotation: Math.PI },

  { id: 'desk-2', type: 'desk', x: 4, z: -2.5, rotation: 0 },
  { id: 'monitor-2', type: 'monitor', x: 4, z: -2.65, rotation: 0 },
  { id: 'chair-2', type: 'chair', x: 4, z: -1.8, rotation: Math.PI },

  // Workstation row 2 (z=0.5, facing forward)
  { id: 'desk-3', type: 'desk', x: -4, z: 0.5, rotation: Math.PI },
  { id: 'monitor-3', type: 'monitor', x: -4, z: 0.65, rotation: Math.PI },
  { id: 'chair-3', type: 'chair', x: -4, z: -0.2, rotation: 0 },

  { id: 'desk-4', type: 'desk', x: 0, z: 0.5, rotation: Math.PI },
  { id: 'monitor-4', type: 'monitor', x: 0, z: 0.65, rotation: Math.PI },
  { id: 'chair-4', type: 'chair', x: 0, z: -0.2, rotation: 0 },

  { id: 'desk-5', type: 'desk', x: 4, z: 0.5, rotation: Math.PI },
  { id: 'monitor-5', type: 'monitor', x: 4, z: 0.65, rotation: Math.PI },
  { id: 'chair-5', type: 'chair', x: 4, z: -0.2, rotation: 0 },

  // Meeting room
  { id: 'roundTable-0', type: 'roundTable', x: 0, z: -5.5, rotation: 0 },
  ...Array.from({ length: 6 }, (_, i) => ({
    id: `mchair-${i}`,
    type: 'chair' as FurnitureType,
    x: Math.cos(i * Math.PI / 3) * 2.0,
    z: -5.5 + Math.sin(i * Math.PI / 3) * 2.0,
    rotation: i * Math.PI / 3 + Math.PI
  })),

  // Lounge
  { id: 'sofa-0', type: 'sofa', x: -3, z: 5, rotation: Math.PI / 2 },
  { id: 'sofa-1', type: 'sofa', x: 3, z: 5, rotation: -Math.PI / 2 },
  { id: 'coffeeTable-0', type: 'coffeeTable', x: 0, z: 5, rotation: 0 },
  { id: 'plant-0', type: 'plant', x: -7, z: 6.5, rotation: 0 },
  { id: 'plant-1', type: 'plant', x: 7, z: 6.5, rotation: 0 },
  { id: 'plant-2', type: 'plant', x: -7, z: 3.5, rotation: 0 },
  { id: 'plant-3', type: 'plant', x: 7, z: 3.5, rotation: 0 }
]

// Office dimensions
export const FLOOR_WIDTH = 20
export const FLOOR_DEPTH = 16
export const WALL_HEIGHT = 3

// Furniture dimensions
export const DESK = { width: 1.2, height: 0.75, depth: 0.6, legRadius: 0.03, legHeight: 0.7 }
export const MONITOR = { width: 0.6, height: 0.4, depth: 0.04, screenEmissive: 0.4 }
export const CHAIR = { seatWidth: 0.45, seatHeight: 0.45, seatDepth: 0.4, backHeight: 0.4, legRadius: 0.02 }
export const ROUND_TABLE = { radius: 1.0, height: 0.75 }
export const SOFA = { width: 1.8, height: 0.5, depth: 0.8, backHeight: 0.4 }
export const PLANT = { potRadius: 0.15, potHeight: 0.25, crownRadius: 0.35, crownHeight: 0.5 }

// Zone centers
export const WORKSTATION_CENTER: [number, number, number] = [0, 0, -1]
export const MEETING_CENTER: [number, number, number] = [0, 0, -5.5]
export const LOUNGE_CENTER: [number, number, number] = [0, 0, 5]

// Workstation slots — 2 rows of 3 desks facing the back wall
export const WORKSTATION_SLOTS: OfficePosition[] = [
  { position: [-4, 0, -2.5], rotation: 0 },
  { position: [0, 0, -2.5], rotation: 0 },
  { position: [4, 0, -2.5], rotation: 0 },
  { position: [-4, 0, 0.5], rotation: Math.PI },
  { position: [0, 0, 0.5], rotation: Math.PI },
  { position: [4, 0, 0.5], rotation: Math.PI }
]

// Meeting slots — 6 chairs around a round table
export const MEETING_SLOTS: OfficePosition[] = Array.from({ length: 6 }, (_, i) => ({
  position: [
    Math.cos(i * Math.PI / 3) * 2.0,
    0,
    -5.5 + Math.sin(i * Math.PI / 3) * 2.0
  ] as [number, number, number],
  rotation: i * Math.PI / 3 + Math.PI
}))

// Lounge slots
export const LOUNGE_SLOTS: OfficePosition[] = [
  { position: [-3.5, 0, 5], rotation: Math.PI / 2 },
  { position: [-2, 0, 5], rotation: -Math.PI / 2 },
  { position: [2, 0, 5], rotation: Math.PI / 2 },
  { position: [3.5, 0, 5], rotation: -Math.PI / 2 }
]

// Colors
export const COLORS = {
  floor: '#18181b',
  floorGrid: '#27272a',
  wall: '#1a1a2e',
  wallOpacity: 0.85,
  desk: '#3f3f46',
  deskLeg: '#52525b',
  monitor: '#27272a',
  monitorScreen: '#1e3a5f',
  chair: '#374151',
  chairSeat: '#4b5563',
  roundTable: '#44403c',
  sofa: '#44403c',
  sofaCushion: '#57534e',
  plant: '#166534',
  plantPot: '#78716c'
}

// Activity colors for status ring
export const ACTIVITY_COLORS: Record<string, string> = {
  idle: '#71717a',
  working: '#22c55e',
  meeting: '#f59e0b',
  walking: '#3b82f6'
}
