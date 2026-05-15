import type { ThemePalette } from '../themeColors'
import type { TeamRole } from '../../../stores/app'
import type { AgentActivity } from '../types'

export type SpriteMap = (0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9)[][]

// Palette indices: 0=transparent, 1=skin, 2=hair, 3=outfit, 4=shoes, 5=outline, 6=accessory, 7=eye, 8=mouth, 9=highlight
export function spritePalette(p: ThemePalette): Record<number, string> {
  return {
    0: 'transparent',
    1: p.skin,
    2: p.outline,
    3: p.outline,
    4: p.outline,
    5: p.outline,
    6: p.screenGlow,
    7: '#000',
    8: p.skinShadow,
    9: '#fff',
  }
}

export function roleColor(role: TeamRole, palette: ThemePalette): Record<number, string> {
  const ROLE_PALETTE: Record<string, { hair: string; outfit: string; accent: string }> = {
    boss:     { hair: '#4F46E5', outfit: '#3730A3', accent: '#EEF2FF' },
    pm:       { hair: '#F59E0B', outfit: '#D97706', accent: '#FFFBEB' },
    developer:{ hair: '#10B981', outfit: '#059669', accent: '#ECFDF5' },
    designer: { hair: '#EC4899', outfit: '#DB2777', accent: '#FDF2F8' },
    tester:   { hair: '#3B82F6', outfit: '#2563EB', accent: '#EFF6FF' },
    worker:   { hair: '#8B5CF6', outfit: '#7C3AED', accent: '#F5F3FF' },
  }
  const rp = ROLE_PALETTE[role] ?? ROLE_PALETTE.worker
  return {
    0: 'transparent',
    1: palette.skin,
    2: palette.skinShadow,
    3: rp.hair,
    4: rp.outfit,
    5: palette.outline,
    6: rp.accent,
    7: '#000',
    8: '#fff',
    9: palette.glowColor,
  }
}

// 16x16 character sprite: front-facing idle pose
// Simplified Kairosoft-style chibi character
const CHAR_IDLE_FRONT: SpriteMap = [
  [0,0,0,0,0,5,5,5,5,5,0,0,0,0,0,0],
  [0,0,0,0,5,3,3,3,3,3,5,0,0,0,0,0],
  [0,0,0,5,3,3,3,3,3,3,3,5,0,0,0,0],
  [0,0,0,5,3,3,3,3,3,3,3,5,0,0,0,0],
  [0,0,0,5,1,7,1,1,1,7,1,5,0,0,0,0],
  [0,0,0,5,1,1,1,8,1,1,1,5,0,0,0,0],
  [0,0,0,0,5,1,1,1,1,1,5,0,0,0,0,0],
  [0,0,0,0,0,5,2,2,2,5,0,0,0,0,0,0],
  [0,0,0,0,5,4,4,6,6,4,4,5,0,0,0,0],
  [0,0,0,5,4,4,4,6,6,4,4,4,5,0,0,0],
  [0,0,0,5,4,4,4,6,6,4,4,4,5,0,0,0],
  [0,0,0,5,4,4,4,4,4,4,4,4,5,0,0,0],
  [0,0,0,5,4,4,4,4,4,4,4,4,5,0,0,0],
  [0,0,0,5,0,4,4,0,0,4,4,0,5,0,0,0],
  [0,0,0,5,0,4,4,0,0,4,4,0,5,0,0,0],
  [0,0,0,0,0,5,5,0,0,5,5,0,0,0,0,0],
]

// Walking frame 1 (left foot forward)
const CHAR_WALK1: SpriteMap = [
  [0,0,0,0,0,5,5,5,5,5,0,0,0,0,0,0],
  [0,0,0,0,5,3,3,3,3,3,5,0,0,0,0,0],
  [0,0,0,5,3,3,3,3,3,3,3,5,0,0,0,0],
  [0,0,0,5,3,3,3,3,3,3,3,5,0,0,0,0],
  [0,0,0,5,1,7,1,1,1,7,1,5,0,0,0,0],
  [0,0,0,5,1,1,1,8,1,1,1,5,0,0,0,0],
  [0,0,0,0,5,1,1,1,1,1,5,0,0,0,0,0],
  [0,0,0,0,0,5,2,2,2,5,0,0,0,0,0,0],
  [0,0,0,0,5,4,4,6,6,4,4,5,0,0,0,0],
  [0,0,0,5,4,4,4,6,6,4,4,4,5,0,0,0],
  [0,0,0,5,4,4,4,6,6,4,4,4,5,0,0,0],
  [0,0,0,5,4,4,4,4,4,4,4,4,5,0,0,0],
  [0,0,0,5,4,4,4,4,4,4,4,4,5,0,0,0],
  [0,0,0,0,5,4,0,0,5,4,0,0,0,0,0,0],
  [0,0,0,0,0,4,4,5,0,0,4,4,0,0,0,0],
  [0,0,0,0,0,5,5,0,0,0,5,5,0,0,0,0],
]

// Working pose (hunched over desk, smaller head)
const CHAR_WORKING: SpriteMap = [
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,5,5,5,5,0,0,0,0,0,0],
  [0,0,0,0,0,5,3,3,3,3,5,0,0,0,0,0],
  [0,0,0,0,5,3,3,3,3,3,3,5,0,0,0,0],
  [0,0,0,0,5,1,7,1,1,7,1,5,0,0,0,0],
  [0,0,0,0,5,1,1,1,8,1,1,5,0,0,0,0],
  [0,0,0,0,0,5,1,1,1,1,5,0,0,0,0,0],
  [0,0,0,0,0,0,5,2,2,5,0,0,0,0,0,0],
  [0,0,0,0,5,4,4,6,6,4,4,5,0,0,0,0],
  [0,0,0,5,4,4,4,6,6,4,4,4,5,0,0,0],
  [0,0,0,5,4,4,4,6,6,4,4,4,5,0,0,0],
  [0,0,0,5,4,4,4,4,4,4,4,4,5,0,0,0],
  [0,0,0,5,4,4,4,4,4,4,4,4,5,0,0,0],
  [0,0,0,5,0,4,4,0,0,4,4,0,5,0,0,0],
  [0,0,0,0,0,5,5,0,0,5,5,0,0,0,0,0],
]

// Meeting pose (sitting, arms out)
const CHAR_MEETING: SpriteMap = [
  [0,0,0,0,0,5,5,5,5,5,0,0,0,0,0,0],
  [0,0,0,0,5,3,3,3,3,3,5,0,0,0,0,0],
  [0,0,0,5,3,3,3,3,3,3,3,5,0,0,0,0],
  [0,0,0,5,3,3,3,3,3,3,3,5,0,0,0,0],
  [0,0,0,5,1,7,1,1,1,7,1,5,0,0,0,0],
  [0,0,0,5,1,1,1,8,1,1,1,5,0,0,0,0],
  [0,0,0,0,5,1,1,1,1,1,5,0,0,0,0,0],
  [0,0,0,0,0,5,2,2,2,5,0,0,0,0,0,0],
  [0,0,5,4,4,4,6,6,4,4,4,5,0,0,0,0],
  [0,0,5,4,4,4,6,6,4,4,4,5,0,0,0,0],
  [0,0,0,5,4,4,6,6,6,4,4,5,0,0,0,0],
  [0,0,0,5,4,4,4,4,4,4,4,5,0,0,0,0],
  [0,0,0,5,4,4,4,4,4,4,4,5,0,0,0,0],
  [0,0,0,5,0,4,4,0,0,4,0,5,0,0,0,0],
  [0,0,0,0,0,4,4,0,0,4,4,0,0,0,0,0],
  [0,0,0,0,0,5,5,0,0,5,5,0,0,0,0,0],
]

export function getCharacterSprite(activity: AgentActivity, animFrame: number): SpriteMap {
  if (activity === 'walking') {
    return animFrame % 2 === 0 ? CHAR_WALK1 : CHAR_IDLE_FRONT
  }
  if (activity === 'working') return CHAR_WORKING
  if (activity === 'meeting') return CHAR_MEETING
  if (activity === 'submitting') return CHAR_WALK1
  return CHAR_IDLE_FRONT
}

// Activity bubble icons (8x8 pixel sprites)
const BUBBLE_WORKING: SpriteMap = [
  [0,0,5,5,5,5,0,0],
  [0,5,9,9,9,9,5,0],
  [5,9,9,5,9,9,9,5],
  [5,9,5,5,9,5,9,5],
  [5,9,9,5,9,9,9,5],
  [5,9,5,5,5,5,9,5],
  [0,5,9,9,9,9,5,0],
  [0,0,5,5,5,5,0,0],
]

const BUBBLE_MEETING: SpriteMap = [
  [0,0,5,5,5,5,0,0],
  [0,5,9,9,9,9,5,0],
  [5,9,9,9,9,9,9,5],
  [5,9,5,9,9,5,9,5],
  [5,9,5,9,9,5,9,5],
  [5,9,9,9,9,9,9,5],
  [0,5,9,9,9,9,5,0],
  [0,0,5,5,5,5,0,0],
]

const BUBBLE_IDLE: SpriteMap = [
  [0,0,5,5,5,5,0,0],
  [0,5,0,0,0,0,5,0],
  [5,0,0,5,0,0,0,5],
  [5,0,0,0,0,5,0,5],
  [5,0,5,0,0,0,0,5],
  [5,0,0,0,5,0,0,5],
  [0,5,0,0,0,0,5,0],
  [0,0,5,5,5,5,0,0],
]

export function getActivityBubble(activity: AgentActivity): SpriteMap | null {
  if (activity === 'working') return BUBBLE_WORKING
  if (activity === 'meeting') return BUBBLE_MEETING
  if (activity === 'idle') return BUBBLE_IDLE
  return null
}
