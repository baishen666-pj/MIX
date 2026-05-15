import { describe, it, expect } from 'vitest'
import {
  DEMO_AGENTS,
  FURNITURE_META,
  DEFAULT_LAYOUT,
  FLOOR_WIDTH,
  FLOOR_DEPTH,
  WALL_HEIGHT,
  DESK,
  MONITOR,
  CHAIR,
  ROUND_TABLE,
  SOFA,
  PLANT,
  WORKSTATION_CENTER,
  MEETING_CENTER,
  LOUNGE_CENTER,
  WORKSTATION_SLOTS,
  MEETING_SLOTS,
  LOUNGE_SLOTS,
  COLORS,
  ACTIVITY_COLORS,
} from '../constants'

describe('DEMO_AGENTS', () => {
  it('has 6 demo agents', () => {
    expect(DEMO_AGENTS).toHaveLength(6)
  })

  it('each agent has required fields', () => {
    for (const agent of DEMO_AGENTS) {
      expect(agent.id).toBeTruthy()
      expect(agent.name).toBeTruthy()
      expect(agent.color).toMatch(/^#[0-9a-f]{6}$/)
      expect(agent.role).toBeTruthy()
      expect(['idle', 'working', 'meeting']).toContain(agent.activity)
    }
  })

  it('all agents have unique ids', () => {
    const ids = DEMO_AGENTS.map((a) => a.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('FURNITURE_META', () => {
  it('covers all expected furniture types', () => {
    const expectedTypes = ['desk', 'monitor', 'chair', 'roundTable', 'sofa', 'plant', 'coffeeTable']
    for (const type of expectedTypes) {
      expect(FURNITURE_META[type as keyof typeof FURNITURE_META]).toBeDefined()
    }
  })

  it('each entry has label, color, width, and depth', () => {
    for (const [type, meta] of Object.entries(FURNITURE_META)) {
      expect(meta.label).toBeTruthy()
      expect(meta.color).toMatch(/^#[0-9a-f]{6}$/)
      expect(meta.width).toBeGreaterThan(0)
      expect(meta.depth).toBeGreaterThan(0)
    }
  })
})

describe('DEFAULT_LAYOUT', () => {
  it('has items', () => {
    expect(DEFAULT_LAYOUT.length).toBeGreaterThan(0)
  })

  it('each layout item has required fields', () => {
    for (const item of DEFAULT_LAYOUT) {
      expect(item.id).toBeTruthy()
      expect(item.type).toBeTruthy()
      expect(typeof item.x).toBe('number')
      expect(typeof item.z).toBe('number')
      expect(typeof item.rotation).toBe('number')
    }
  })

  it('all layout item types are valid furniture types', () => {
    const validTypes = new Set(Object.keys(FURNITURE_META))
    for (const item of DEFAULT_LAYOUT) {
      expect(validTypes.has(item.type)).toBe(true)
    }
  })

  it('all layout item ids are unique', () => {
    const ids = DEFAULT_LAYOUT.map((i) => i.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('Office dimensions', () => {
  it('FLOOR_WIDTH is 20', () => {
    expect(FLOOR_WIDTH).toBe(20)
  })

  it('FLOOR_DEPTH is 16', () => {
    expect(FLOOR_DEPTH).toBe(16)
  })

  it('WALL_HEIGHT is 3', () => {
    expect(WALL_HEIGHT).toBe(3)
  })
})

describe('Furniture dimension constants', () => {
  it('DESK has positive dimensions', () => {
    expect(DESK.width).toBeGreaterThan(0)
    expect(DESK.height).toBeGreaterThan(0)
    expect(DESK.depth).toBeGreaterThan(0)
  })

  it('MONITOR has positive dimensions', () => {
    expect(MONITOR.width).toBeGreaterThan(0)
    expect(MONITOR.height).toBeGreaterThan(0)
    expect(MONITOR.depth).toBeGreaterThan(0)
    expect(MONITOR.screenEmissive).toBeGreaterThanOrEqual(0)
  })

  it('CHAIR has positive dimensions', () => {
    expect(CHAIR.seatWidth).toBeGreaterThan(0)
    expect(CHAIR.seatHeight).toBeGreaterThan(0)
    expect(CHAIR.seatDepth).toBeGreaterThan(0)
    expect(CHAIR.backHeight).toBeGreaterThan(0)
  })

  it('ROUND_TABLE has positive radius and height', () => {
    expect(ROUND_TABLE.radius).toBeGreaterThan(0)
    expect(ROUND_TABLE.height).toBeGreaterThan(0)
  })

  it('SOFA has positive dimensions', () => {
    expect(SOFA.width).toBeGreaterThan(0)
    expect(SOFA.height).toBeGreaterThan(0)
    expect(SOFA.depth).toBeGreaterThan(0)
    expect(SOFA.backHeight).toBeGreaterThan(0)
  })

  it('PLANT has positive dimensions', () => {
    expect(PLANT.potRadius).toBeGreaterThan(0)
    expect(PLANT.potHeight).toBeGreaterThan(0)
    expect(PLANT.crownRadius).toBeGreaterThan(0)
    expect(PLANT.crownHeight).toBeGreaterThan(0)
  })
})

describe('Zone centers', () => {
  it('WORKSTATION_CENTER is a 3-element tuple', () => {
    expect(WORKSTATION_CENTER).toHaveLength(3)
    WORKSTATION_CENTER.forEach((v) => expect(typeof v).toBe('number'))
  })

  it('MEETING_CENTER is a 3-element tuple', () => {
    expect(MEETING_CENTER).toHaveLength(3)
    MEETING_CENTER.forEach((v) => expect(typeof v).toBe('number'))
  })

  it('LOUNGE_CENTER is a 3-element tuple', () => {
    expect(LOUNGE_CENTER).toHaveLength(3)
    LOUNGE_CENTER.forEach((v) => expect(typeof v).toBe('number'))
  })
})

describe('Slot arrays', () => {
  it('WORKSTATION_SLOTS has 6 positions', () => {
    expect(WORKSTATION_SLOTS).toHaveLength(6)
  })

  it('MEETING_SLOTS has 6 positions', () => {
    expect(MEETING_SLOTS).toHaveLength(6)
  })

  it('LOUNGE_SLOTS has 4 positions', () => {
    expect(LOUNGE_SLOTS).toHaveLength(4)
  })

  it('each slot has position and rotation', () => {
    const allSlots = [...WORKSTATION_SLOTS, ...MEETING_SLOTS, ...LOUNGE_SLOTS]
    for (const slot of allSlots) {
      expect(slot.position).toHaveLength(3)
      expect(typeof slot.rotation).toBe('number')
    }
  })
})

describe('COLORS', () => {
  it('has all expected color keys', () => {
    const expectedKeys = [
      'floor', 'floorGrid', 'wall', 'wallOpacity',
      'desk', 'deskLeg', 'monitor', 'monitorScreen',
      'chair', 'chairSeat', 'roundTable', 'sofa', 'sofaCushion',
      'plant', 'plantPot',
    ]
    for (const key of expectedKeys) {
      expect(COLORS[key as keyof typeof COLORS]).toBeDefined()
    }
  })

  it('wallOpacity is between 0 and 1', () => {
    expect(COLORS.wallOpacity).toBeGreaterThanOrEqual(0)
    expect(COLORS.wallOpacity).toBeLessThanOrEqual(1)
  })

  it('hex colors are valid format', () => {
    for (const [key, value] of Object.entries(COLORS)) {
      if (key === 'wallOpacity') continue
      expect(value).toMatch(/^#[0-9a-f]{6}$/)
    }
  })
})

describe('ACTIVITY_COLORS', () => {
  it('has colors for all activity types', () => {
    expect(ACTIVITY_COLORS.idle).toBeDefined()
    expect(ACTIVITY_COLORS.working).toBeDefined()
    expect(ACTIVITY_COLORS.meeting).toBeDefined()
    expect(ACTIVITY_COLORS.walking).toBeDefined()
  })

  it('all values are valid hex colors', () => {
    for (const color of Object.values(ACTIVITY_COLORS)) {
      expect(color).toMatch(/^#[0-9a-f]{6}$/)
    }
  })
})
