import { create } from 'zustand'
import { genId } from '../lib/genId'

export type TeamRole = 'boss' | 'pm' | 'developer' | 'designer' | 'tester' | 'worker'

export interface TeamMember {
  id: string
  name: string
  role: TeamRole
  color: string
  activity: 'idle' | 'working' | 'meeting' | 'walking' | 'submitting'
}

export interface ProjectRoom {
  id: string
  name: string
  members: TeamMember[]
  floor: number
  position: { x: number; z: number }
}

export interface ApprovalRequest {
  id: string
  fromMemberId: string
  fromMemberName: string
  fromProjectId: string
  fromProjectName: string
  title: string
  description: string
  context?: string
  status: 'pending' | 'approved' | 'rejected'
  createdAt: number
  respondedAt?: number
}

interface OfficeState {
  projectRooms: ProjectRoom[]
  approvalRequests: ApprovalRequest[]
  addProjectRoom: (name: string) => void
  removeProjectRoom: (id: string) => void
  addTeamMember: (roomId: string, role: TeamRole, name: string) => void
  removeTeamMember: (roomId: string, memberId: string) => void
  updateMemberActivity: (roomId: string, memberId: string, activity: TeamMember['activity']) => void
  submitApproval: (request: Omit<ApprovalRequest, 'id' | 'status' | 'createdAt'>) => void
  respondApproval: (id: string, approved: boolean) => void
  notify: (title: string, body: string) => void
}

export const useOfficeStore = create<OfficeState>((set) => ({
  projectRooms: [],
  approvalRequests: [],

  addProjectRoom: (name) => set((s) => {
    const id = genId('room-')
    const floor = Math.floor(s.projectRooms.length / 2)
    const col = s.projectRooms.length % 2
    const room: ProjectRoom = {
      id,
      name,
      members: [
        { id: `${id}-pm`, name: `${name}经理`, role: 'pm', color: '#F59E0B', activity: 'working' },
        { id: `${id}-dev1`, name: '开发', role: 'developer', color: '#10B981', activity: 'working' },
        { id: `${id}-dev2`, name: '开发', role: 'developer', color: '#10B981', activity: 'working' },
        { id: `${id}-design`, name: '设计', role: 'designer', color: '#EC4899', activity: 'working' },
        { id: `${id}-qa`, name: '测试', role: 'tester', color: '#3B82F6', activity: 'working' }
      ],
      floor,
      position: { x: col * 12 - 6, z: floor * 16 }
    }
    return { projectRooms: [...s.projectRooms, room] }
  }),

  removeProjectRoom: (id) => set((s) => ({
    projectRooms: s.projectRooms.filter((r) => r.id !== id)
  })),

  addTeamMember: (roomId, role, name) => set((s) => ({
    projectRooms: s.projectRooms.map((r) =>
      r.id === roomId
        ? { ...r, members: [...r.members, { id: genId('m-'), name, role, color: '#8B5CF6', activity: 'idle' as const }] }
        : r
    )
  })),

  removeTeamMember: (roomId, memberId) => set((s) => ({
    projectRooms: s.projectRooms.map((r) =>
      r.id === roomId
        ? { ...r, members: r.members.filter((m) => m.id !== memberId) }
        : r
    )
  })),

  updateMemberActivity: (roomId, memberId, activity) => set((s) => ({
    projectRooms: s.projectRooms.map((r) =>
      r.id === roomId
        ? { ...r, members: r.members.map((m) => m.id === memberId ? { ...m, activity } : m) }
        : r
    )
  })),

  submitApproval: (req) => set((s) => ({
    approvalRequests: [...s.approvalRequests, {
      ...req,
      id: genId('approval-'),
      status: 'pending' as const,
      createdAt: Date.now()
    }]
  })),

  respondApproval: (id, approved) => set((s) => ({
    approvalRequests: s.approvalRequests.map((r) =>
      r.id === id ? { ...r, status: approved ? 'approved' as const : 'rejected' as const, respondedAt: Date.now() } : r
    )
  })),

  notify: (title, body) => {
    if (window.mixDesktop?.sendNotification) {
      window.mixDesktop.sendNotification({ title, body }).catch(() => {})
    }
  }
}))
