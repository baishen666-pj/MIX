import { create } from 'zustand'
import { genId } from '../lib/genId'
import type { LayoutItem } from '../components/three/types'
import { DEFAULT_LAYOUT } from '../components/three/constants'
let _onProfileSwitch: (() => void) | null = null
export function setProfileSwitchHandler(handler: () => void) {
  _onProfileSwitch = handler
}

export interface CanvasAgent {
  id: string
  label: string
  role: string
  model: string
  color: string
  position: { x: number; y: number }
  connections: string[]
  tools: string[]
  status: 'idle' | 'running' | 'error' | 'success'
}

export interface Profile {
  id: string
  name: string
  soulPrompt: string
  officeLayout: LayoutItem[]
  activeProviderId: string
  canvasAgents: CanvasAgent[]
}

const DEFAULT_PROFILE: Profile = {
  id: 'default',
  name: '默认',
  soulPrompt: '',
  officeLayout: DEFAULT_LAYOUT,
  activeProviderId: 'zhipu',
  canvasAgents: []
}

export const ART_AGENT_SOUL = `你是一个专业的像素美术 Agent，专门为 2D 游戏生成视觉资源。

## 核心能力
- 使用 image.generate 工具生成像素风游戏美术资源
- 精通 16x16、32x32 像素画风格
- 了解开罗(Kairosoft)游戏风格的视觉特征：温暖的色调、可爱的Q版角色、精致的小场景

## 生图规则
- 所有图片使用 pixel art 风格
- 色调温暖明亮，饱和度适中
- 角色为 Q版/Chibi 比例（大头小身体）
- 场景为俯视角(top-down)或轻微等轴测视角
- 尺寸优先使用 1024x1024，quality 用 "low" 保持像素感

## 可生成的资源类型
1. **场景图** — 办公室全景、会议室、休息区、老板办公室
2. **角色精灵** — 不同职业的Q版角色（老板、项目经理、程序员、设计师、测试员）
3. **家具图标** — 桌椅、电脑、沙发、植物、咖啡机
4. **UI 元素** — 状态图标、气泡对话框、活动指示器

## 工作流程
当用户要求生成美术资源时：
1. 明确需求（场景/角色/家具/UI、风格、色调）
2. 构造精确的英文 prompt（像素画用英文 prompt 效果更好）
3. 调用 image.generate 工具
4. 告知用户生成的图片保存路径和用途建议

## Prompt 模板
- 场景: "16x16 pixel art top-down [场景名], warm colors, Kairosoft game style, cute chibi proportions, cozy atmosphere, detailed furniture, bright lighting"
- 角色: "16x16 pixel art sprite sheet, top-down view, [角色描述], chibi style, 4-direction walking animation, game character"
- 家具: "16x16 pixel art icon, top-down view, [家具名], warm wood tones, game asset, clean edges"`

const ART_PROFILE: Profile = {
  id: 'art-agent',
  name: '美术 Agent',
  soulPrompt: ART_AGENT_SOUL,
  officeLayout: [...DEFAULT_LAYOUT],
  activeProviderId: 'openai',
  canvasAgents: []
}

export const PRESET_PROFILES: Profile[] = [
  { ...DEFAULT_PROFILE },
  ART_PROFILE,
]

interface ProfileState {
  profiles: Profile[]
  activeProfileId: string
  soulPrompt: string
  officeLayout: LayoutItem[]
  canvasAgents: CanvasAgent[]
  switchProfile: (id: string) => void
  createProfile: (name: string) => void
  deleteProfile: (id: string) => void
  renameProfile: (id: string, name: string) => void
  setSoulPrompt: (prompt: string) => void
  setOfficeLayout: (items: LayoutItem[]) => void
  setCanvasAgents: (agents: CanvasAgent[]) => void
}

function updateActiveProfile(profiles: Profile[], activeProfileId: string, patch: Partial<Profile>): Profile[] {
  return profiles.map((p) =>
    p.id === activeProfileId ? { ...p, ...patch } : p
  )
}

export const useProfileStore = create<ProfileState>((set, _get) => ({
  profiles: PRESET_PROFILES.map((p) => ({ ...p })),
  activeProfileId: 'default',
  soulPrompt: DEFAULT_PROFILE.soulPrompt,
  officeLayout: DEFAULT_PROFILE.officeLayout,
  canvasAgents: DEFAULT_PROFILE.canvasAgents,

  switchProfile: (id) =>
    set((s) => {
      const profile = s.profiles.find((p) => p.id === id)
      if (!profile) return {}
      _onProfileSwitch?.()
      return {
        activeProfileId: id,
        soulPrompt: profile.soulPrompt,
        officeLayout: profile.officeLayout,
        canvasAgents: profile.canvasAgents
      }
    }),

  createProfile: (name) =>
    set((s) => {
      const id = genId('profile-')
      const newProfile: Profile = {
        id,
        name,
        soulPrompt: '',
        officeLayout: [...DEFAULT_LAYOUT],
        activeProviderId: s.activeProfileId,
        canvasAgents: []
      }
      _onProfileSwitch?.()
      return {
        profiles: [...s.profiles, newProfile],
        activeProfileId: id,
        soulPrompt: newProfile.soulPrompt,
        officeLayout: newProfile.officeLayout,
        canvasAgents: newProfile.canvasAgents
      }
    }),

  deleteProfile: (id) =>
    set((s) => {
      if (s.profiles.length <= 1) return {}
      const profiles = s.profiles.filter((p) => p.id !== id)
      if (s.activeProfileId !== id) return { profiles }
      const first = profiles[0]
      _onProfileSwitch?.()
      return {
        profiles,
        activeProfileId: first.id,
        soulPrompt: first.soulPrompt,
        officeLayout: first.officeLayout,
        canvasAgents: first.canvasAgents
      }
    }),

  renameProfile: (id, name) =>
    set((s) => ({
      profiles: s.profiles.map((p) => p.id === id ? { ...p, name } : p)
    })),

  setSoulPrompt: (soulPrompt) =>
    set((s) => ({ soulPrompt, profiles: updateActiveProfile(s.profiles, s.activeProfileId, { soulPrompt }) })),

  setOfficeLayout: (officeLayout) =>
    set((s) => ({ officeLayout, profiles: updateActiveProfile(s.profiles, s.activeProfileId, { officeLayout }) })),

  setCanvasAgents: (canvasAgents) =>
    set((s) => ({ canvasAgents, profiles: updateActiveProfile(s.profiles, s.activeProfileId, { canvasAgents }) }))
}))
