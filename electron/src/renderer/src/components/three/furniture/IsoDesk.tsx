import { toIso } from '../IsoEngine'
import { usePalette } from '../PaletteContext'

export function IsoDesk({ x, z, rotation = 0 }: { x: number; z: number; rotation?: number }) {
  const pos = toIso(x, z)
  const { palette } = usePalette()

  const w = 30, depth = 8, h = 12
  const topY = -22
  const dx = 5

  const topPath = `M${-w / 2 + 3},${topY}
    L${w / 2 - 3},${topY} Q${w / 2},${topY} ${w / 2},${topY + 2}
    L${w / 2 + dx - 2},${topY + depth} Q${w / 2 + dx},${topY + depth} ${w / 2 + dx - 2},${topY + depth}
    L${-w / 2 + dx + 2},${topY + depth} Q${-w / 2 + dx},${topY + depth} ${-w / 2 + dx},${topY + depth - 2}
    L${-w / 2},${topY + 2} Q${-w / 2},${topY} ${-w / 2 + 3},${topY} Z`

  const drawer1Y = topY + depth + 3
  const drawer2Y = topY + depth + 7

  const grainL = -w / 2 + 6
  const grainR = w / 2 - 2

  return (
    <g transform={`translate(${pos.x},${pos.y}) rotate(${rotation * 30})`}>
      {/* Ground shadow */}
      <ellipse cx="2" cy={topY + depth + h + 4} rx="23" ry="6.5"
        fill="rgba(0,0,0,0.08)" filter="url(#furniture-shadow)" />

      {/* Right face (shadow side) */}
      <polygon
        points={`${w / 2},${topY} ${w / 2 + dx},${topY + depth} ${w / 2 + dx},${topY + depth + h} ${w / 2},${topY + h}`}
        fill={palette.woodDark} stroke={palette.woodDark} strokeWidth="1" opacity="0.85"
      />

      {/* Front face */}
      <polygon
        points={`${-w / 2 + dx},${topY + depth} ${w / 2 + dx},${topY + depth} ${w / 2 + dx},${topY + depth + h} ${-w / 2 + dx},${topY + depth + h}`}
        fill={palette.woodMid} stroke={palette.woodDark} strokeWidth="1"
      />

      {/* Front drawers with inset effect */}
      <rect x={-w / 2 + dx + 3} y={drawer1Y} width={w - 8} height="3.5" rx="1"
        fill={palette.woodDark} opacity="0.5" />
      {/* Drawer inner shadow line */}
      <line x1={-w / 2 + dx + 4} y1={drawer1Y + 0.5} x2={w / 2 + dx - 5} y2={drawer1Y + 0.5}
        stroke="black" strokeWidth="0.3" opacity="0.15" />
      {/* Drawer handle */}
      <circle cx={w / 2 + dx - 6} cy={drawer1Y + 1.7} r="1.2" fill={palette.metalLight} opacity="0.7" />
      <circle cx={w / 2 + dx - 6} cy={drawer1Y + 1.5} r="0.4" fill="white" opacity="0.1" />

      <rect x={-w / 2 + dx + 3} y={drawer2Y} width={w - 8} height="3.5" rx="1"
        fill={palette.woodDark} opacity="0.5" />
      <line x1={-w / 2 + dx + 4} y1={drawer2Y + 0.5} x2={w / 2 + dx - 5} y2={drawer2Y + 0.5}
        stroke="black" strokeWidth="0.3" opacity="0.15" />
      <circle cx={w / 2 + dx - 6} cy={drawer2Y + 1.7} r="1.2" fill={palette.metalLight} opacity="0.7" />
      <circle cx={w / 2 + dx - 6} cy={drawer2Y + 1.5} r="0.4" fill="white" opacity="0.1" />

      {/* Top face */}
      <path d={topPath} fill={palette.woodLight} stroke={palette.woodDark} strokeWidth="1.5" />

      {/* Wood grain lines on top (more natural) */}
      <line x1={grainL} y1={topY + 2} x2={grainR} y2={topY + 2}
        stroke={palette.woodDark} strokeWidth="0.6" opacity="0.1" />
      <line x1={grainL + 1} y1={topY + 4} x2={grainR - 1} y2={topY + 4}
        stroke={palette.woodDark} strokeWidth="0.4" opacity="0.08" />
      <line x1={grainL + dx / 2} y1={topY + depth / 2 - 1} x2={grainR + dx / 2} y2={topY + depth / 2 - 1}
        stroke={palette.woodDark} strokeWidth="0.6" opacity="0.1" />
      <line x1={grainL + dx - 1} y1={topY + depth - 3} x2={grainR + dx - 1} y2={topY + depth - 3}
        stroke={palette.woodDark} strokeWidth="0.6" opacity="0.1" />
      <line x1={grainL + dx - 2} y1={topY + depth - 1} x2={grainR + dx - 2} y2={topY + depth - 1}
        stroke={palette.woodDark} strokeWidth="0.4" opacity="0.08" />

      {/* Edge highlight: top face all edges */}
      <path d={topPath} fill="none" stroke="white" strokeWidth="0.8" opacity="0.12" />
      {/* Stronger front edge highlight */}
      <line
        x1={-w / 2 + dx + 2} y1={topY + depth}
        x2={w / 2 + dx - 2} y2={topY + depth}
        stroke="white" strokeWidth="1.2" opacity="0.18"
      />
    </g>
  )
}
