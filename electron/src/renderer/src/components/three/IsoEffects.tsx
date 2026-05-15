import { toIso } from './IsoEngine'
import { usePalette } from './PaletteContext'

export function ApprovalGlow({ cx, cz }: { cx: number; cz: number }) {
  const { palette } = usePalette()
  const pos = toIso(cx, cz)

  return (
    <g transform={`translate(${pos.x},${pos.y})`}>
      {/* Outer ring */}
      <ellipse cx="0" cy="0" rx="70" ry="35" fill="none" stroke={palette.glowColor} strokeWidth="1.5" opacity={0.2}>
        <animate attributeName="stroke-width" values="1;2.5;1" dur="1.4s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.1;0.35;0.1" dur="1.4s" repeatCount="indefinite" />
      </ellipse>
      {/* Middle ring */}
      <ellipse cx="0" cy="0" rx="60" ry="30" fill="none" stroke={palette.glowColor} strokeWidth="2" opacity={0.35}>
        <animate attributeName="stroke-width" values="1.5;3.5;1.5" dur="1.2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.2;0.55;0.2" dur="1.2s" repeatCount="indefinite" />
      </ellipse>
      {/* Inner ring */}
      <ellipse cx="0" cy="0" rx="50" ry="25" fill="none" stroke={palette.glowColor} strokeWidth="3" opacity={0.6}>
        <animate attributeName="stroke-width" values="2;4;2" dur="1s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.3;0.8;0.3" dur="1s" repeatCount="indefinite" />
      </ellipse>
    </g>
  )
}

export function ReturnBurst({ x, z, approved }: { x: number; z: number; approved: boolean }) {
  const { palette } = usePalette()
  const pos = toIso(x, z)
  const color = approved ? palette.glowColor : 'var(--t-danger)'

  const particles = [
    { dx: -12, dy: -6, dur: '0.7s' },
    { dx: 12, dy: -6, dur: '0.75s' },
    { dx: -8, dy: -20, dur: '0.65s' },
    { dx: 8, dy: -20, dur: '0.8s' },
    { dx: 0, dy: -30, dur: '0.6s' },
  ]

  return (
    <g transform={`translate(${pos.x},${pos.y})`}>
      {/* Vertical beam */}
      <line x1="0" y1="0" x2="0" y2="-40" stroke={color} strokeWidth="2" opacity="0.5">
        <animate attributeName="opacity" values="0.7;0" dur="0.8s" fill="freeze" />
      </line>
      {/* Ground ring */}
      <ellipse cx="0" cy="0" rx="15" ry="7" fill="none" stroke={color} strokeWidth="2" opacity="0.4">
        <animate attributeName="rx" values="15;25" dur="0.8s" fill="freeze" />
        <animate attributeName="ry" values="7;12" dur="0.8s" fill="freeze" />
        <animate attributeName="opacity" values="0.4;0" dur="0.8s" fill="freeze" />
      </ellipse>
      {/* Check or X */}
      {approved ? (
        <g transform="translate(0,-45)">
          <polyline points="-4,0 0,4 6,-4" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <animate attributeName="opacity" values="1;0" dur="0.8s" fill="freeze" begin="0.2s" />
          </polyline>
        </g>
      ) : (
        <g transform="translate(0,-45)">
          <line x1="-4" y1="-4" x2="4" y2="4" stroke={color} strokeWidth="2.5" strokeLinecap="round">
            <animate attributeName="opacity" values="1;0" dur="0.8s" fill="freeze" begin="0.2s" />
          </line>
          <line x1="4" y1="-4" x2="-4" y2="4" stroke={color} strokeWidth="2.5" strokeLinecap="round">
            <animate attributeName="opacity" values="1;0" dur="0.8s" fill="freeze" begin="0.2s" />
          </line>
        </g>
      )}
      {/* Burst particles */}
      {particles.map((p, i) => (
        <circle key={i} cx="0" cy="0" r="2" fill={color}>
          <animate attributeName="opacity" values="0.8;0" dur={p.dur} fill="freeze" />
          <animate attributeName="cx" values={`0;${p.dx}`} dur={p.dur} fill="freeze" />
          <animate attributeName="cy" values={`0;${p.dy}`} dur={p.dur} fill="freeze" />
        </circle>
      ))}
    </g>
  )
}

export function WalkTrail({ positions }: { positions: { x: number; z: number }[] }) {
  const { palette } = usePalette()
  if (positions.length === 0) return null
  return (
    <g>
      {positions.map((p, i) => {
        const pos = toIso(p.x, p.z)
        const opacity = 0.15 * (1 - i / positions.length)
        const isRight = i % 2 === 0
        const offsetX = isRight ? -3 : 3
        const rotAngle = isRight ? -15 : 15
        return (
          <g key={i} transform={`translate(${pos.x + offsetX},${pos.y}) rotate(${rotAngle})`}>
            <ellipse cx="0" cy="0" rx="3" ry="2" fill={palette.screenGlow} opacity={opacity} />
            <ellipse cx="0" cy="-3.5" rx="2" ry="1.5" fill={palette.screenGlow} opacity={opacity} />
          </g>
        )
      })}
    </g>
  )
}
