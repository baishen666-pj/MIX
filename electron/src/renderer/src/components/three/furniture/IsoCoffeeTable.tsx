import { toIso } from '../IsoEngine'
import { usePalette } from '../PaletteContext'

// --- IsoCoffeeTable: small 3-face table with legs, coffee cup with steam ---
export function IsoCoffeeTable({ x, z }: { x: number; z: number }) {
  const pos = toIso(x, z)
  const { palette } = usePalette()

  const w = 22, depth = 6, h = 8
  const topY = -10
  const dx = 4

  return (
    <g transform={`translate(${pos.x},${pos.y})`}>
      {/* Ground shadow */}
      <ellipse cx="2" cy={topY + depth + h + 7} rx="16" ry="5"
        fill="rgba(0,0,0,0.07)" filter="url(#furniture-shadow)" />

      {/* 4 legs */}
      <line x1={-w / 2 + 3} y1={topY + depth + h} x2={-w / 2 + 3} y2={topY + depth + h + 6}
        stroke={palette.woodDark} strokeWidth="2" />
      <line x1={-w / 2 + dx + 3} y1={topY + depth + h} x2={-w / 2 + dx + 3} y2={topY + depth + h + 6}
        stroke={palette.woodDark} strokeWidth="2" />
      <line x1={w / 2 - 3} y1={topY + h} x2={w / 2 - 3} y2={topY + h + 6}
        stroke={palette.woodDark} strokeWidth="2" />
      <line x1={w / 2 + dx - 3} y1={topY + depth + h} x2={w / 2 + dx - 3} y2={topY + depth + h + 6}
        stroke={palette.woodDark} strokeWidth="2" />

      {/* Right face */}
      <polygon
        points={`${w / 2},${topY} ${w / 2 + dx},${topY + depth} ${w / 2 + dx},${topY + depth + h} ${w / 2},${topY + h}`}
        fill={palette.woodDark} stroke={palette.woodDark} strokeWidth="1" opacity="0.85"
      />

      {/* Front face */}
      <polygon
        points={`${-w / 2 + dx},${topY + depth} ${w / 2 + dx},${topY + depth} ${w / 2 + dx},${topY + depth + h} ${-w / 2 + dx},${topY + depth + h}`}
        fill={palette.woodMid} stroke={palette.woodDark} strokeWidth="1"
      />

      {/* Top face */}
      <polygon
        points={`${-w / 2},${topY} ${w / 2},${topY} ${w / 2 + dx},${topY + depth} ${-w / 2 + dx},${topY + depth}`}
        fill={palette.woodLight} stroke={palette.woodDark} strokeWidth="1.5"
      />

      {/* Edge highlight: front edge of top face */}
      <line
        x1={-w / 2 + dx} y1={topY + depth}
        x2={w / 2 + dx} y2={topY + depth}
        stroke="white" strokeWidth="1" opacity="0.2"
      />

      {/* Coffee cup on top */}
      <rect x="1" y={topY - 5} width="4" height="5" rx="1.5"
        fill={palette.metalLight} stroke={palette.metalDark} strokeWidth="0.5" />
      {/* Cup opening */}
      <ellipse cx="3" cy={topY - 5} rx="2" ry="1" fill={palette.metalMid} />
      {/* Steam wavy lines */}
      <path d={`M2,${topY - 6} Q2.5,${topY - 9} 2,${topY - 11}`} fill="none"
        stroke={palette.screenGlow} strokeWidth="0.5" opacity="0.3" />
      <path d={`M4,${topY - 6} Q3.5,${topY - 8} 4,${topY - 10}`} fill="none"
        stroke={palette.screenGlow} strokeWidth="0.5" opacity="0.25" />
    </g>
  )
}
