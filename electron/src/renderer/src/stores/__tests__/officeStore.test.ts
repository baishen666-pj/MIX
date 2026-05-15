import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useOfficeStore } from '../officeStore'

describe('officeStore', () => {
  beforeEach(() => {
    useOfficeStore.setState({ projectRooms: [], approvalRequests: [] })
  })

  describe('addProjectRoom', () => {
    it('adds a room with generated members', () => {
      useOfficeStore.getState().addProjectRoom('项目A')
      const rooms = useOfficeStore.getState().projectRooms
      expect(rooms).toHaveLength(1)
      expect(rooms[0].name).toBe('项目A')
      expect(rooms[0].members.length).toBeGreaterThanOrEqual(3)
    })

    it('generates unique room IDs', () => {
      useOfficeStore.getState().addProjectRoom('A')
      useOfficeStore.getState().addProjectRoom('B')
      const rooms = useOfficeStore.getState().projectRooms
      expect(rooms[0].id).not.toBe(rooms[1].id)
    })

    it('assigns different positions for multiple rooms', () => {
      useOfficeStore.getState().addProjectRoom('A')
      useOfficeStore.getState().addProjectRoom('B')
      const rooms = useOfficeStore.getState().projectRooms
      expect(rooms[0].position).toBeDefined()
      expect(rooms[1].position).toBeDefined()
    })
  })

  describe('removeProjectRoom', () => {
    it('removes a room by id', () => {
      useOfficeStore.getState().addProjectRoom('A')
      useOfficeStore.getState().addProjectRoom('B')
      const roomId = useOfficeStore.getState().projectRooms[0].id
      useOfficeStore.getState().removeProjectRoom(roomId)
      expect(useOfficeStore.getState().projectRooms).toHaveLength(1)
      expect(useOfficeStore.getState().projectRooms[0].name).toBe('B')
    })

    it('no-ops for non-existent id', () => {
      useOfficeStore.getState().addProjectRoom('A')
      useOfficeStore.getState().removeProjectRoom('nonexistent')
      expect(useOfficeStore.getState().projectRooms).toHaveLength(1)
    })
  })

  describe('addTeamMember', () => {
    it('adds a member to the specified room', () => {
      useOfficeStore.getState().addProjectRoom('A')
      const roomId = useOfficeStore.getState().projectRooms[0].id
      const initialCount = useOfficeStore.getState().projectRooms[0].members.length
      useOfficeStore.getState().addTeamMember(roomId, 'worker', '小王')
      const room = useOfficeStore.getState().projectRooms.find((r) => r.id === roomId)
      expect(room!.members).toHaveLength(initialCount + 1)
      expect(room!.members[room!.members.length - 1].name).toBe('小王')
    })

    it('does not affect other rooms', () => {
      useOfficeStore.getState().addProjectRoom('A')
      useOfficeStore.getState().addProjectRoom('B')
      const roomA = useOfficeStore.getState().projectRooms[0].id
      const roomBCount = useOfficeStore.getState().projectRooms[1].members.length
      useOfficeStore.getState().addTeamMember(roomA, 'worker', '小王')
      expect(useOfficeStore.getState().projectRooms[1].members).toHaveLength(roomBCount)
    })
  })

  describe('removeTeamMember', () => {
    it('removes a member by id', () => {
      useOfficeStore.getState().addProjectRoom('A')
      const room = useOfficeStore.getState().projectRooms[0]
      const memberId = room.members[0].id
      useOfficeStore.getState().removeTeamMember(room.id, memberId)
      const updated = useOfficeStore.getState().projectRooms[0]
      expect(updated.members.find((m) => m.id === memberId)).toBeUndefined()
    })

    it('no-ops for non-existent room id', () => {
      useOfficeStore.getState().addProjectRoom('A')
      const beforeCount = useOfficeStore.getState().projectRooms[0].members.length
      useOfficeStore.getState().removeTeamMember('nonexistent', 'some-member')
      expect(useOfficeStore.getState().projectRooms[0].members).toHaveLength(beforeCount)
    })

    it('no-ops for non-existent member id in valid room', () => {
      useOfficeStore.getState().addProjectRoom('A')
      const roomId = useOfficeStore.getState().projectRooms[0].id
      const beforeCount = useOfficeStore.getState().projectRooms[0].members.length
      useOfficeStore.getState().removeTeamMember(roomId, 'nonexistent-member')
      expect(useOfficeStore.getState().projectRooms[0].members).toHaveLength(beforeCount)
    })

    it('does not affect other rooms', () => {
      useOfficeStore.getState().addProjectRoom('A')
      useOfficeStore.getState().addProjectRoom('B')
      const roomA = useOfficeStore.getState().projectRooms[0]
      const roomBCount = useOfficeStore.getState().projectRooms[1].members.length
      const memberId = roomA.members[0].id
      useOfficeStore.getState().removeTeamMember(roomA.id, memberId)
      expect(useOfficeStore.getState().projectRooms[1].members).toHaveLength(roomBCount)
    })
  })

  describe('updateMemberActivity', () => {
    it('updates a member activity', () => {
      useOfficeStore.getState().addProjectRoom('A')
      const room = useOfficeStore.getState().projectRooms[0]
      const memberId = room.members[0].id
      useOfficeStore.getState().updateMemberActivity(room.id, memberId, 'meeting')
      const updated = useOfficeStore.getState().projectRooms[0]
      expect(updated.members.find((m) => m.id === memberId)!.activity).toBe('meeting')
    })
  })

  describe('submitApproval', () => {
    it('creates a pending approval', () => {
      useOfficeStore.getState().submitApproval({
        fromMemberId: 'm1',
        fromMemberName: '开发',
        fromProjectId: 'p1',
        fromProjectName: '项目A',
        title: '代码合并请求',
        description: '请审核 PR #42',
      })
      const approvals = useOfficeStore.getState().approvalRequests
      expect(approvals).toHaveLength(1)
      expect(approvals[0].status).toBe('pending')
      expect(approvals[0].title).toBe('代码合并请求')
      expect(approvals[0].createdAt).toBeGreaterThan(0)
    })
  })

  describe('respondApproval', () => {
    it('approves a request', () => {
      useOfficeStore.getState().submitApproval({
        fromMemberId: 'm1', fromMemberName: '开发',
        fromProjectId: 'p1', fromProjectName: 'A',
        title: 'test', description: 'test',
      })
      const id = useOfficeStore.getState().approvalRequests[0].id
      useOfficeStore.getState().respondApproval(id, true)
      expect(useOfficeStore.getState().approvalRequests[0].status).toBe('approved')
      expect(useOfficeStore.getState().approvalRequests[0].respondedAt).toBeGreaterThan(0)
    })

    it('rejects a request', () => {
      useOfficeStore.getState().submitApproval({
        fromMemberId: 'm1', fromMemberName: '开发',
        fromProjectId: 'p1', fromProjectName: 'A',
        title: 'test', description: 'test',
      })
      const id = useOfficeStore.getState().approvalRequests[0].id
      useOfficeStore.getState().respondApproval(id, false)
      expect(useOfficeStore.getState().approvalRequests[0].status).toBe('rejected')
      expect(useOfficeStore.getState().approvalRequests[0].respondedAt).toBeGreaterThan(0)
    })

    it('no-ops for non-existent approval id', () => {
      useOfficeStore.getState().submitApproval({
        fromMemberId: 'm1', fromMemberName: '开发',
        fromProjectId: 'p1', fromProjectName: 'A',
        title: 'test', description: 'test',
      })
      useOfficeStore.getState().respondApproval('nonexistent', true)
      expect(useOfficeStore.getState().approvalRequests).toHaveLength(1)
      expect(useOfficeStore.getState().approvalRequests[0].status).toBe('pending')
    })

    it('does not affect other approval requests', () => {
      useOfficeStore.getState().submitApproval({
        fromMemberId: 'm1', fromMemberName: '开发',
        fromProjectId: 'p1', fromProjectName: 'A',
        title: 'first', description: 'first',
      })
      useOfficeStore.getState().submitApproval({
        fromMemberId: 'm2', fromMemberName: '设计',
        fromProjectId: 'p2', fromProjectName: 'B',
        title: 'second', description: 'second',
      })
      const firstId = useOfficeStore.getState().approvalRequests[0].id
      useOfficeStore.getState().respondApproval(firstId, true)
      expect(useOfficeStore.getState().approvalRequests[0].status).toBe('approved')
      expect(useOfficeStore.getState().approvalRequests[1].status).toBe('pending')
    })
  })

  describe('notify', () => {
    let hadWindow: boolean
    beforeEach(() => {
      hadWindow = 'window' in globalThis
      if (!hadWindow) (globalThis as Record<string, unknown>).window = globalThis
    })
    afterEach(() => {
      if (!hadWindow) delete (globalThis as Record<string, unknown>).window
      else (globalThis as Record<string, unknown>).window = undefined
    })

    it('calls window.mixDesktop.sendNotification when available', () => {
      const sendNotification = vi.fn().mockResolvedValue(undefined)
      const g = globalThis as Record<string, unknown>
      const originalAiGui = g.mixDesktop
      g.mixDesktop = { sendNotification }
      useOfficeStore.getState().notify('Title', 'Body text')
      expect(sendNotification).toHaveBeenCalledWith({ title: 'Title', body: 'Body text' })
      g.mixDesktop = originalAiGui
    })

    it('does not throw when window.mixDesktop is undefined', () => {
      const g = globalThis as Record<string, unknown>
      const originalAiGui = g.mixDesktop
      g.mixDesktop = undefined
      expect(() => useOfficeStore.getState().notify('Title', 'Body')).not.toThrow()
      g.mixDesktop = originalAiGui
    })

    it('does not throw when sendNotification rejects', () => {
      const sendNotification = vi.fn().mockRejectedValue(new Error('fail'))
      const g = globalThis as Record<string, unknown>
      const originalAiGui = g.mixDesktop
      g.mixDesktop = { sendNotification }
      expect(() => useOfficeStore.getState().notify('Title', 'Body')).not.toThrow()
      g.mixDesktop = originalAiGui
    })
  })
})
