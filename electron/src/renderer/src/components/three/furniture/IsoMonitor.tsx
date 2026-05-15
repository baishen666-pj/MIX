import { toIso } from '../IsoEngine'
import { usePalette } from '../PaletteContext'

export function IsoMonitor({ x, z }: { x: number; z: number }) {
  const pos = toIso(x, z)
  const { palette } = usePalette()

  const gradId = `screenGrad-${x}-${z}`
  const glareId = `glareGrad-${x}-${z}`

  return (
    <g transform={`translate(${pos.x},${pos.y})`}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={palette.metalDark} />
          <stop offset="60%" stopColor={palette.screenGlow} stopOpacity="0.25" />
          <stop offset="100%" stopColor={palette.screenGlow} stopOpacity="0.15" />
        </linearGradient>
        <linearGradient id={glareId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="white" stopOpacity="0.12" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Ground shadow */}
      <ellipse cx="0" cy="-6" rx="9" ry="3"
        fill="rgba(0,0,0,0.07)" filter="url(#furniture-shadow)" />

      {/* Outer bezel */}
      <rect x="-13" y="-34" width="26" height="18" rx="2"
        fill={palette.metalDark} stroke={palette.metalDark} strokeWidth="1.5" />
      {/* Bezel edge highlight */}
      <rect x="-12.5" y="-33.5" width="25" height="1" rx="0.5"
        fill="white" opacity="0.06" />

      {/* Screen with gradient */}
      <rect x="-11" y="-32" width="22" height="14" rx="1"
        fill={`url(#${gradId})`} />

      {/* Code lines with syntax highlighting */}
      <line x1="-8" y1="-29.5" x2="4" y2="-29.5" stroke={palette.screenGlow} strokeWidth="1.2" opacity="0.55" />
      <line x1="-8" y1="-27" x2="7" y2="-27" stroke={palette.glowColor} strokeWidth="1" opacity="0.3" />
      <line x1="-8" y1="-24.5" x2="1" y2="-24.5" stroke={palette.screenGlow} strokeWidth="1.2" opacity="0.45" />
      <line x1="-6" y1="-22" x2="5" y2="-22" stroke={palette.glowColor} strokeWidth="1" opacity="0.35" />
      <line x1="-8" y1="-19.5" x2="-2" y2="-19.5" stroke={palette.screenGlow} strokeWidth="1.2" opacity="0.4" />

      {/* Screen glare (diagonal reflection) */}
      <rect x="-11" y="-32" width="10" height="7" rx="1"
        fill={`url(#${glareId})`} />

      {/* Screen edge glow */}
      <rect x="-11" y="-32" width="22" height="14" rx="1"
        fill="none" stroke={palette.screenGlow} strokeWidth="0.5" opacity="0.15" />

      {/* Y-stand: vertical stem */}
      <line x1="0" y1="-16" x2="0" y2="-9" stroke={palette.metalMid} strokeWidth="2.5" />
      {/* Stem highlight */}
      <line x1="-0.5" y1="-15" x2="-0.5" y2="-10" stroke="white" strokeWidth="0.5" opacity="0.1" />
      {/* Y-stand: base ellipse */}
      <ellipse cx="0" cy="-8" rx="6" ry="2" fill={palette.metalMid} stroke={palette.metalDark} strokeWidth="0.5" />
      {/* Base highlight */}
      <ellipse cx="0" cy="-8.3" rx="4" ry="1" fill="white" opacity="0.05" />
    </g>
  )
}
