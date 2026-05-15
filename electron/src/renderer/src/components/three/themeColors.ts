// Theme-aware color system per Art Bible Section 4
// Each theme defines depth planes + atmosphere + material tones

export interface ThemePalette {
  // Depth planes (3-tone isometric shading)
  topFill: string    // lit surface
  leftFill: string   // mid surface
  rightFill: string  // shadow surface

  // Materials
  woodLight: string
  woodMid: string
  woodDark: string
  metalLight: string
  metalMid: string
  metalDark: string
  screenGlow: string
  fabricFill: string
  fabricShadow: string

  // Environment
  floorFill: string
  floorStroke: string
  wallFill: string
  wallFill2: string
  wallStroke: string
  windowFill: string
  windowStroke: string

  // Nature
  plantLight: string
  plantMid: string
  plantDark: string
  potFill: string
  potStroke: string

  // Character
  outline: string
  outlineW: string
  skin: string
  skinShadow: string

  // Effects
  shadowOpacity: string
  glowColor: string

  // Premium additions
  floorHighlight: string
  wallAccent: string
  ambientLight: string
  ambientOpacity: string
}

export const DARK_PALETTE: ThemePalette = {
  topFill: '#4a4540', leftFill: '#2d2a26', rightFill: '#1f1d19',
  woodLight: '#a08968', woodMid: '#7d6b50', woodDark: '#5c4a32',
  metalLight: '#9ca3af', metalMid: '#6b7280', metalDark: '#4b5563',
  screenGlow: '#3b82f6', fabricFill: '#7c7396', fabricShadow: '#5b5078',
  floorFill: '#2a2722', floorStroke: '#3d3a35',
  wallFill: '#33303a', wallFill2: '#28252e', wallStroke: '#4a4650',
  windowFill: '#1e3a5f', windowStroke: '#4a6a8a',
  plantLight: '#5ee89a', plantMid: '#22c55e', plantDark: '#15803d',
  potFill: '#a0642a', potStroke: '#7c4e1e',
  outline: '#1a1815', outlineW: '1.5',
  skin: '#fce4b8', skinShadow: '#d4a56a',
  shadowOpacity: '0.2', glowColor: '#4ade80',
  floorHighlight: '#4a4540', wallAccent: '#524e58',
  ambientLight: '#60a5fa', ambientOpacity: '0.08',
}

export const LIGHT_PALETTE: ThemePalette = {
  topFill: '#f0ece4', leftFill: '#e0dbd2', rightFill: '#d0cbc2',
  woodLight: '#d4b896', woodMid: '#b89872', woodDark: '#9a7d58',
  metalLight: '#e5e7eb', metalMid: '#c8cbd0', metalDark: '#a0a5ac',
  screenGlow: '#2563eb', fabricFill: '#9590b8', fabricShadow: '#706a94',
  floorFill: '#f5f0e8', floorStroke: '#d5cfc4',
  wallFill: '#eae5dc', wallFill2: '#dfd9cf', wallStroke: '#b0a898',
  windowFill: '#a5c8f0', windowStroke: '#7daad8',
  plantLight: '#5ee89a', plantMid: '#22c55e', plantDark: '#15803d',
  potFill: '#c4803a', potStroke: '#a06828',
  outline: '#3d3830', outlineW: '1.5',
  skin: '#fce4b8', skinShadow: '#d4a56a',
  shadowOpacity: '0.1', glowColor: '#22c55e',
  floorHighlight: '#f5f0e8', wallAccent: '#c8c0b4',
  ambientLight: '#93c5fd', ambientOpacity: '0.06',
}

export const CYBERPUNK_PALETTE: ThemePalette = {
  topFill: '#35005a', leftFill: '#250040', rightFill: '#180028',
  woodLight: '#9333ea', woodMid: '#7e22ce', woodDark: '#6b21a8',
  metalLight: '#c084fc', metalMid: '#a855f7', metalDark: '#9333ea',
  screenGlow: '#00ffc8', fabricFill: '#e879f9', fabricShadow: '#c026d3',
  floorFill: '#1a0035', floorStroke: '#4a0080',
  wallFill: '#2a004d', wallFill2: '#220042', wallStroke: '#7c3aed',
  windowFill: '#3b0764', windowStroke: '#a855f7',
  plantLight: '#00ffc8', plantMid: '#06d6a0', plantDark: '#059669',
  potFill: '#6b21a8', potStroke: '#581c87',
  outline: '#0f0020', outlineW: '1.5',
  skin: '#fce4b8', skinShadow: '#d4a56a',
  shadowOpacity: '0.3', glowColor: '#00ffc8',
  floorHighlight: '#4a0080', wallAccent: '#9333ea',
  ambientLight: '#00ffc8', ambientOpacity: '0.1',
}

const PALETTES: Record<string, ThemePalette> = {
  dark: DARK_PALETTE,
  light: LIGHT_PALETTE,
  cyberpunk: CYBERPUNK_PALETTE,
}

export function getPalette(theme: string): ThemePalette {
  return PALETTES[theme] ?? DARK_PALETTE
}
