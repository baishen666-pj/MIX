import { toIso } from '../IsoEngine'
import { usePalette } from '../PaletteContext'

export function IsoSofa({ x, z }: { x: number; z: number }) {
  const pos = toIso(x, z)
  const { palette } = usePalette()

  const w = 36, depth = 10, h = 14
  const topY = -18
  const dx = 6

  return (
    <g transform={`translate(${pos.x},${pos.y})`}>
      {/* Ground shadow */}
      <ellipse cx="3" cy={topY + depth + h + 4} rx="25" ry="7.5"
        fill="rgba(0,0,0,0.08)" filter="url(#furniture-shadow)" />

      {/* Right face (shadow side) */}
      <polygon
        points={`${w / 2},${topY} ${w / 2 + dx},${topY + depth} ${w / 2 + dx},${topY + depth + h} ${w / 2},${topY + h}`}
        fill={palette.fabricShadow} stroke={palette.fabricShadow} strokeWidth="1" opacity="0.7"
      />

      {/* Front face */}
      <polygon
        points={`${-w / 2 + dx},${topY + depth} ${w / 2 + dx},${topY + depth} ${w / 2 + dx},${topY + depth + h} ${-w / 2 + dx},${topY + depth + h}`}
        fill={palette.fabricShadow} stroke={palette.fabricShadow} strokeWidth="1" opacity="0.9"
      />

      {/* Fabric texture on front: subtle cross lines */}
      {[-3, 0, 3, 6].map((offY) => (
        <line key={`tex-${offY}`}
          x1={-w / 2 + dx + 3} y1={topY + depth + 3 + offY}
          x2={w / 2 + dx - 3} y2={topY + depth + 3 + offY}
          stroke={palette.fabricFill} strokeWidth="0.5" opacity="0.06" />
      ))}
      {[0, 7, 14, 21, 28].map((offX) => (
        <line key={`texv-${offX}`}
          x1={-w / 2 + dx + 3 + offX} y1={topY + depth + 3}
          x2={-w / 2 + dx + 3 + offX} y2={topY + depth + h - 2}
          stroke={palette.fabricFill} strokeWidth="0.5" opacity="0.06" />
      ))}

      {/* Top face - rounded */}
      <path
        d={`M${-w / 2 + 4},${topY}
            L${w / 2 - 4},${topY} Q${w / 2},${topY} ${w / 2},${topY + 3}
            L${w / 2 + dx - 3},${topY + depth} Q${w / 2 + dx},${topY + depth} ${w / 2 + dx - 3},${topY + depth}
            L${-w / 2 + dx + 3},${topY + depth} Q${-w / 2 + dx},${topY + depth} ${-w / 2 + dx},${topY + depth - 3}
            L${-w / 2},${topY + 3} Q${-w / 2},${topY} ${-w / 2 + 4},${topY} Z`}
        fill={palette.fabricFill} stroke={palette.fabricShadow} strokeWidth="1"
      />
      {/* Top face highlight */}
      <path
        d={`M${-w / 2 + 6},${topY + 1}
            L${w / 2 - 6},${topY + 1} Q${w / 2 - 2},${topY + 1} ${w / 2 - 2},${topY + 3}
            L${w / 2 + dx - 5},${topY + depth - 2}
            L${-w / 2 + dx + 5},${topY + depth - 2}
            L${-w / 2 + 2},${topY + 3} Q${-w / 2 + 2},${topY + 1} ${-w / 2 + 6},${topY + 1} Z`}
        fill="white" opacity="0.04" />

      {/* Cushion depression lines */}
      <path d={`M${-w / 2 + 10},${topY + 2} Q${-w / 2 + 10 + dx / 2},${topY + depth / 2} ${-w / 2 + 10},${topY + depth - 2}`}
        fill="none" stroke={palette.fabricShadow} strokeWidth="0.8" opacity="0.12" />
      <path d={`M${w / 2 - 10},${topY + 2} Q${w / 2 - 10 + dx / 2},${topY + depth / 2} ${w / 2 - 10},${topY + depth - 2}`}
        fill="none" stroke={palette.fabricShadow} strokeWidth="0.8" opacity="0.12" />

      {/* Edge highlight: front edge of top face */}
      <line
        x1={-w / 2 + dx + 3} y1={topY + depth}
        x2={w / 2 + dx - 3} y2={topY + depth}
        stroke="white" strokeWidth="1" opacity="0.15"
      />

      {/* Armrests - curved with highlight */}
      <path d={`M${-w / 2 - 2},${topY + 4} Q${-w / 2 - 5},${topY + 8} ${-w / 2 - 2},${topY + depth + h - 4}`}
        fill="none" stroke={palette.fabricFill} strokeWidth="6" strokeLinecap="round" />
      <path d={`M${-w / 2 - 2.5},${topY + 5} Q${-w / 2 - 4},${topY + 8} ${-w / 2 - 2.5},${topY + depth + h - 5}`}
        fill="none" stroke="white" strokeWidth="1" opacity="0.08" strokeLinecap="round" />
      <path d={`M${w / 2 + dx + 2},${topY + 4} Q${w / 2 + dx + 5},${topY + 8} ${w / 2 + dx + 2},${topY + depth + h - 4}`}
        fill="none" stroke={palette.fabricFill} strokeWidth="6" strokeLinecap="round" />
      <path d={`M${w / 2 + dx + 1.5},${topY + 5} Q${w / 2 + dx + 4},${topY + 8} ${w / 2 + dx + 1.5},${topY + depth + h - 5}`}
        fill="none" stroke="white" strokeWidth="1" opacity="0.08" strokeLinecap="round" />

      {/* Back pillows with highlight */}
      <ellipse cx={-8} cy={topY + depth + 4} rx="6.5" ry="4.5"
        fill={palette.fabricFill} stroke={palette.fabricShadow} strokeWidth="0.5" opacity="0.7" />
      <ellipse cx={-9} cy={topY + depth + 3} rx="3" ry="1.5"
        fill="white" opacity="0.04" />
      <ellipse cx={8} cy={topY + depth + 4} rx="6.5" ry="4.5"
        fill={palette.fabricFill} stroke={palette.fabricShadow} strokeWidth="0.5" opacity="0.7" />
      <ellipse cx={7} cy={topY + depth + 3} rx="3" ry="1.5"
        fill="white" opacity="0.04" />
    </g>
  )
}
