import { toIso } from '../IsoEngine'
import { usePalette } from '../PaletteContext'

export function IsoChair({ x, z }: { x: number; z: number }) {
  const pos = toIso(x, z)
  const { palette } = usePalette()

  const spokeLen = 7
  const cx = 0, cy = 2
  const spokeAngles = [0, 72, 144, 216, 288]
  const spokes = spokeAngles.map((deg) => {
    const rad = (deg * Math.PI) / 180
    return {
      x2: cx + Math.cos(rad) * spokeLen,
      y2: cy + Math.sin(rad) * spokeLen * 0.5,
    }
  })

  return (
    <g transform={`translate(${pos.x},${pos.y})`}>
      {/* Ground shadow */}
      <ellipse cx="0" cy="5" rx="11" ry="4.5"
        fill="rgba(0,0,0,0.06)" filter="url(#furniture-shadow)" />

      {/* Five-star base spokes */}
      {spokes.map((s, i) => (
        <line key={`spoke-${i}`} x1={cx} y1={cy} x2={s.x2} y2={s.y2}
          stroke={palette.metalMid} strokeWidth="1.5" />
      ))}
      {/* Wheels (small circles with highlight) */}
      {spokes.map((s, i) => (
        <g key={`wheel-${i}`}>
          <circle cx={s.x2} cy={s.y2} r="1.8" fill={palette.metalDark} />
          <circle cx={s.x2 - 0.3} cy={s.y2 - 0.3} r="0.5" fill="white" opacity="0.1" />
        </g>
      ))}
      {/* Center hub */}
      <circle cx={cx} cy={cy} r="2" fill={palette.metalMid} />
      {/* Gas cylinder */}
      <rect x="-1.5" y="-4" width="3" height="6" rx="1" fill={palette.metalMid} />
      {/* Cylinder highlight */}
      <line x1="-0.5" y1="-3" x2="-0.5" y2="1" stroke="white" strokeWidth="0.5" opacity="0.1" />

      {/* Seat cushion (softer ellipse) */}
      <ellipse cx="0" cy="-6" rx="11" ry="5.5"
        fill={palette.fabricFill} stroke={palette.fabricShadow} strokeWidth="1" />
      {/* Seat cushion highlight */}
      <ellipse cx="-1" cy="-7" rx="7" ry="3"
        fill="white" opacity="0.04" />
      {/* Seat seam lines */}
      <line x1="-6" y1="-6" x2="6" y2="-6" stroke={palette.fabricShadow} strokeWidth="0.6" opacity="0.15" />
      <line x1="-3" y1="-8.5" x2="-3" y2="-3.5" stroke={palette.fabricShadow} strokeWidth="0.4" opacity="0.08" />
      <line x1="3" y1="-8.5" x2="3" y2="-3.5" stroke={palette.fabricShadow} strokeWidth="0.4" opacity="0.08" />

      {/* Backrest (slightly curved) */}
      <path d="M-9,-22 Q-9.5,-13 -8,-13 L8,-13 Q9.5,-13 9,-22 Z"
        fill={palette.fabricFill} stroke={palette.fabricShadow} strokeWidth="1" />
      {/* Backrest curve detail */}
      <path d="M-7,-14 Q0,-11 7,-14" fill="none" stroke={palette.fabricShadow} strokeWidth="0.8" opacity="0.3" />
      {/* Backrest edge highlight */}
      <path d="M-8,-21 Q0,-24 8,-21" fill="none" stroke="white" strokeWidth="0.8" opacity="0.12"
        strokeLinecap="round" />
      {/* Backrest lumbar support line */}
      <path d="M-6,-16 Q0,-14.5 6,-16" fill="none" stroke={palette.fabricShadow} strokeWidth="0.5" opacity="0.15" />
    </g>
  )
}
