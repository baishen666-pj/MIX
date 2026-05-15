import type { TeamRole } from '../../stores/app'
import type { AgentActivity } from './types'

export function getIrisColor(role: TeamRole, color: string): string {
  const map: Record<TeamRole, string> = {
    boss: '#6366f1',
    pm: '#3b82f6',
    developer: '#22c55e',
    designer: '#ec4899',
    tester: '#f59e0b',
    worker: '#a78bfa',
  }
  return map[role] || color
}

export function getBounce(activity: AgentActivity, t: number): number {
  switch (activity) {
    case 'idle': return Math.sin(t * 2.4) * 1.5
    case 'working': return 0
    case 'meeting': return Math.sin(t * 1.5) * 0.8
    case 'walking': return Math.abs(Math.sin(t * 12)) * 3
    case 'submitting': return Math.sin(t * 6) * 2
    default: return 0
  }
}

export function getLimbAngles(activity: AgentActivity, t: number) {
  switch (activity) {
    case 'idle': return { leftArm: 5, rightArm: -5, leftLeg: 0, rightLeg: 0 }
    case 'working': return {
      leftArm: -40 + Math.sin(t * 5) * 8,
      rightArm: -40 + Math.sin(t * 5 + Math.PI) * 8,
      leftLeg: 0, rightLeg: 0
    }
    case 'meeting': return {
      leftArm: -25 + Math.sin(t * 2) * 10,
      rightArm: 5,
      leftLeg: 0, rightLeg: 0
    }
    case 'walking': return {
      leftArm: Math.sin(t * 12) * 25,
      rightArm: Math.sin(t * 12 + Math.PI) * 25,
      leftLeg: Math.sin(t * 12 + Math.PI) * 20,
      rightLeg: Math.sin(t * 12) * 20
    }
    case 'submitting': return {
      leftArm: -10,
      rightArm: -60,
      leftLeg: 0, rightLeg: 0
    }
    default: return { leftArm: 0, rightArm: 0, leftLeg: 0, rightLeg: 0 }
  }
}

export type Expression = 'neutral' | 'focused' | 'happy' | 'worried' | 'thinking'

export function getExpression(activity: AgentActivity): Expression {
  switch (activity) {
    case 'working': return 'focused'
    case 'meeting': return 'thinking'
    case 'submitting': return 'worried'
    default: return 'neutral'
  }
}
