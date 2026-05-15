import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useProfileStore, setProfileSwitchHandler } from '../profileStore'

describe('profileStore', () => {
  beforeEach(() => {
    useProfileStore.setState({
      profiles: [{ id: 'default', name: '默认', soulPrompt: '', officeLayout: [], activeProviderId: 'zhipu', canvasAgents: [] }],
      activeProfileId: 'default',
      soulPrompt: '',
      officeLayout: [],
      canvasAgents: [],
    })
  })

  describe('initial state', () => {
    it('has a default profile', () => {
      const s = useProfileStore.getState()
      expect(s.profiles).toHaveLength(1)
      expect(s.activeProfileId).toBe('default')
    })
  })

  describe('createProfile', () => {
    it('creates a new profile and switches to it', () => {
      useProfileStore.getState().createProfile('工作')
      const s = useProfileStore.getState()
      expect(s.profiles).toHaveLength(2)
      expect(s.profiles[1].name).toBe('工作')
      expect(s.activeProfileId).not.toBe('default')
    })
  })

  describe('deleteProfile', () => {
    it('deletes a profile and switches to remaining one', () => {
      useProfileStore.getState().createProfile('工作')
      const workId = useProfileStore.getState().activeProfileId
      useProfileStore.getState().deleteProfile(workId)
      expect(useProfileStore.getState().profiles).toHaveLength(1)
      expect(useProfileStore.getState().activeProfileId).toBe('default')
    })

    it('no-ops when only one profile remains', () => {
      useProfileStore.getState().deleteProfile('default')
      expect(useProfileStore.getState().profiles).toHaveLength(1)
    })
  })

  describe('renameProfile', () => {
    it('renames a profile', () => {
      useProfileStore.getState().renameProfile('default', '个人')
      expect(useProfileStore.getState().profiles[0].name).toBe('个人')
    })
  })

  describe('setSoulPrompt', () => {
    it('updates soul prompt for active profile', () => {
      useProfileStore.getState().setSoulPrompt('You are a helpful assistant.')
      expect(useProfileStore.getState().soulPrompt).toBe('You are a helpful assistant.')
      expect(useProfileStore.getState().profiles[0].soulPrompt).toBe('You are a helpful assistant.')
    })
  })

  describe('setCanvasAgents', () => {
    it('updates canvas agents for active profile', () => {
      const agents = [{ id: 'a1', label: 'Agent 1', role: 'dev', model: 'gpt-4', color: '#fff', position: { x: 0, y: 0 }, connections: [], tools: [], status: 'idle' as const }]
      useProfileStore.getState().setCanvasAgents(agents)
      expect(useProfileStore.getState().canvasAgents).toHaveLength(1)
      expect(useProfileStore.getState().profiles[0].canvasAgents).toHaveLength(1)
    })
  })

  describe('switchProfile', () => {
    it('switches to another profile', () => {
      useProfileStore.getState().setSoulPrompt('Default prompt')
      useProfileStore.getState().createProfile('工作')
      useProfileStore.getState().setSoulPrompt('Work prompt')
      useProfileStore.getState().switchProfile('default')
      expect(useProfileStore.getState().soulPrompt).toBe('Default prompt')
      expect(useProfileStore.getState().activeProfileId).toBe('default')
    })

    it('no-ops for non-existent profile', () => {
      useProfileStore.getState().switchProfile('nonexistent')
      expect(useProfileStore.getState().activeProfileId).toBe('default')
    })
  })

  describe('setOfficeLayout', () => {
    it('updates office layout for active profile', () => {
      const layout = [{ id: 'd1', type: 'desk' as const, x: 1, z: 2, rotation: 0 }]
      useProfileStore.getState().setOfficeLayout(layout)
      expect(useProfileStore.getState().officeLayout).toEqual(layout)
      expect(useProfileStore.getState().profiles[0].officeLayout).toEqual(layout)
    })

    it('replaces previous layout', () => {
      const layout1 = [{ id: 'd1', type: 'desk' as const, x: 1, z: 2, rotation: 0 }]
      const layout2 = [{ id: 'c1', type: 'chair' as const, x: 3, z: 4, rotation: 90 }]
      useProfileStore.getState().setOfficeLayout(layout1)
      useProfileStore.getState().setOfficeLayout(layout2)
      expect(useProfileStore.getState().officeLayout).toEqual(layout2)
      expect(useProfileStore.getState().profiles[0].officeLayout).toEqual(layout2)
    })

    it('sets empty layout', () => {
      const layout = [{ id: 'd1', type: 'desk' as const, x: 0, z: 0, rotation: 0 }]
      useProfileStore.getState().setOfficeLayout(layout)
      useProfileStore.getState().setOfficeLayout([])
      expect(useProfileStore.getState().officeLayout).toEqual([])
      expect(useProfileStore.getState().profiles[0].officeLayout).toEqual([])
    })
  })

  describe('renameProfile', () => {
    it('renames a non-active profile without affecting active id', () => {
      useProfileStore.getState().createProfile('工作')
      const workId = useProfileStore.getState().activeProfileId
      useProfileStore.getState().switchProfile('default')
      useProfileStore.getState().renameProfile(workId, '项目')
      const renamed = useProfileStore.getState().profiles.find((p) => p.id === workId)
      expect(renamed!.name).toBe('项目')
      expect(useProfileStore.getState().activeProfileId).toBe('default')
    })

    it('renames active profile', () => {
      useProfileStore.getState().renameProfile('default', '个人')
      expect(useProfileStore.getState().profiles[0].name).toBe('个人')
    })
  })

  describe('setCanvasAgents', () => {
    it('replaces existing canvas agents', () => {
      const agents1 = [
        { id: 'a1', label: 'Agent 1', role: 'dev', model: 'gpt-4', color: '#fff', position: { x: 0, y: 0 }, connections: [], tools: [], status: 'idle' as const },
        { id: 'a2', label: 'Agent 2', role: 'dev', model: 'gpt-4', color: '#fff', position: { x: 100, y: 100 }, connections: [], tools: [], status: 'idle' as const },
      ]
      const agents2 = [
        { id: 'a3', label: 'Agent 3', role: 'pm', model: 'claude', color: '#000', position: { x: 50, y: 50 }, connections: ['a1'], tools: ['search'], status: 'running' as const },
      ]
      useProfileStore.getState().setCanvasAgents(agents1)
      useProfileStore.getState().setCanvasAgents(agents2)
      expect(useProfileStore.getState().canvasAgents).toHaveLength(1)
      expect(useProfileStore.getState().canvasAgents[0].id).toBe('a3')
      expect(useProfileStore.getState().profiles[0].canvasAgents).toHaveLength(1)
    })

    it('clears agents with empty array', () => {
      const agents = [
        { id: 'a1', label: 'Agent 1', role: 'dev', model: 'gpt-4', color: '#fff', position: { x: 0, y: 0 }, connections: [], tools: [], status: 'idle' as const },
      ]
      useProfileStore.getState().setCanvasAgents(agents)
      useProfileStore.getState().setCanvasAgents([])
      expect(useProfileStore.getState().canvasAgents).toHaveLength(0)
      expect(useProfileStore.getState().profiles[0].canvasAgents).toHaveLength(0)
    })
  })

  describe('setProfileSwitchHandler', () => {
    it('invokes handler on switchProfile', () => {
      const handler = vi.fn()
      setProfileSwitchHandler(handler)
      useProfileStore.getState().createProfile('New')
      useProfileStore.getState().switchProfile('default')
      expect(handler).toHaveBeenCalled()
    })

    it('invokes handler on createProfile', () => {
      const handler = vi.fn()
      setProfileSwitchHandler(handler)
      useProfileStore.getState().createProfile('New')
      expect(handler).toHaveBeenCalled()
    })

    it('invokes handler on deleteProfile when active', () => {
      const handler = vi.fn()
      setProfileSwitchHandler(handler)
      useProfileStore.getState().createProfile('ToDelete')
      handler.mockClear()
      const workId = useProfileStore.getState().activeProfileId
      useProfileStore.getState().deleteProfile(workId)
      expect(handler).toHaveBeenCalled()
    })

    it('replaces previous handler', () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()
      setProfileSwitchHandler(handler1)
      setProfileSwitchHandler(handler2)
      useProfileStore.getState().createProfile('New')
      expect(handler1).not.toHaveBeenCalled()
      expect(handler2).toHaveBeenCalled()
    })
  })
})
