import type { ThemePalette } from '../themeColors'

interface RoomDefsProps {
  gradId: string; tileId: string; winGradId?: string; lightId?: string
  palette: ThemePalette; floorColor?: string
}

export function RoomDefs({ gradId, tileId, winGradId, lightId, palette, floorColor }: RoomDefsProps) {
  return (
    <defs>
      {/* Floor gradient: from window side (warm) to far side */}
      <linearGradient id={gradId} x1="0" y1="0" x2="0.3" y2="1">
        <stop offset="0%" stopColor={palette.floorHighlight} stopOpacity="0.06" />
        <stop offset="60%" stopColor={floorColor ?? palette.floorFill} stopOpacity="0" />
      </linearGradient>
      {/* Subtle tile pattern */}
      <pattern id={tileId} width="8" height="8" patternUnits="userSpaceOnUse">
        <rect width="4" height="4" fill={palette.floorStroke} opacity="0.02" />
        <rect x="4" y="4" width="4" height="4" fill={palette.floorStroke} opacity="0.02" />
      </pattern>
      {/* Window gradient */}
      {winGradId && (
        <linearGradient id={winGradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={palette.windowFill} stopOpacity="0.7" />
          <stop offset="100%" stopColor={palette.windowFill} stopOpacity="0.3" />
        </linearGradient>
      )}
      {/* Floor light cone from window */}
      {lightId && (
        <linearGradient id={lightId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={palette.ambientLight} stopOpacity={palette.ambientOpacity} />
          <stop offset="100%" stopColor={palette.ambientLight} stopOpacity="0" />
        </linearGradient>
      )}
    </defs>
  )
}
