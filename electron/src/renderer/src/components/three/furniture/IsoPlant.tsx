import { toIso } from '../IsoEngine'
import { usePalette } from '../PaletteContext'

export function IsoPlant({ x, z }: { x: number; z: number }) {
  const pos = toIso(x, z)
  const { palette } = usePalette()

  const gradId = `leafGrad-${x}-${z}`
  const grad2Id = `leafGrad2-${x}-${z}`

  const leaves = [
    { cx: 0, cy: -25, rx: 8, ry: 5.5, color: 'light' },
    { cx: -6, cy: -22, rx: 6, ry: 4, color: 'mid' },
    { cx: 6, cy: -21, rx: 6, ry: 3.5, color: 'light' },
    { cx: -3, cy: -28, rx: 5, ry: 3.5, color: 'mid' },
    { cx: 4, cy: -29, rx: 5, ry: 3, color: 'light' },
    { cx: -5, cy: -17, rx: 4, ry: 2.5, color: 'mid' },
    { cx: 5, cy: -16, rx: 4, ry: 2.5, color: 'dark' },
    { cx: 0, cy: -19, rx: 4.5, ry: 3, color: 'dark' },
  ]

  return (
    <g transform={`translate(${pos.x},${pos.y})`}>
      <defs>
        <radialGradient id={gradId}>
          <stop offset="0%" stopColor={palette.plantLight} />
          <stop offset="100%" stopColor={palette.plantMid} />
        </radialGradient>
        <radialGradient id={grad2Id}>
          <stop offset="0%" stopColor={palette.plantMid} />
          <stop offset="100%" stopColor={palette.plantDark} />
        </radialGradient>
      </defs>

      {/* Ground shadow */}
      <ellipse cx="0" cy="5" rx="9" ry="3.5"
        fill="rgba(0,0,0,0.07)" filter="url(#furniture-shadow)" />

      {/* Pot body (trapezoid with slight curve) */}
      <path d="M-7,-8 L-5.5,2 Q0,3 5.5,2 L7,-8 Z"
        fill={palette.potFill} stroke={palette.potStroke} strokeWidth="1" />
      {/* Pot side highlight */}
      <path d="M-6.5,-7 L-5.5,1" fill="none" stroke="white" strokeWidth="0.5" opacity="0.08" />

      {/* Pot rim (ellipse) */}
      <ellipse cx="0" cy="-8" rx="7.5" ry="3.2" fill={palette.potFill} stroke={palette.potStroke} strokeWidth="0.8" />
      {/* Pot rim highlight */}
      <path d={`M-6.5,-8 A7.5,3.2 0 0 0 6.5,-8`} fill="none" stroke="white" strokeWidth="0.8" opacity="0.12" />

      {/* Soil inside pot */}
      <ellipse cx="0" cy="-8" rx="6" ry="2.2" fill={palette.potStroke} opacity="0.25" />
      {/* Soil texture dots */}
      <circle cx="-2" cy="-8" r="0.5" fill={palette.potStroke} opacity="0.12" />
      <circle cx="1.5" cy="-7.5" r="0.4" fill={palette.potStroke} opacity="0.1" />
      <circle cx="3" cy="-8.2" r="0.3" fill={palette.potStroke} opacity="0.1" />

      {/* Stems (more organic curves) */}
      <path d="M0,-9 Q0,-15 0,-24" fill="none" stroke={palette.plantDark} strokeWidth="1.5" />
      <path d="M0,-11 Q-3,-14 -5,-20" fill="none" stroke={palette.plantDark} strokeWidth="1" />
      <path d="M0,-11 Q3,-13 5,-18" fill="none" stroke={palette.plantDark} strokeWidth="1" />
      <path d="M0,-13 Q-2,-16 -4,-16" fill="none" stroke={palette.plantDark} strokeWidth="0.8" />
      <path d="M0,-15 Q2,-18 4,-21" fill="none" stroke={palette.plantDark} strokeWidth="0.8" />

      {/* Leaves with varied gradients */}
      {leaves.map((leaf, i) => (
        <ellipse key={`leaf-${i}`} cx={leaf.cx} cy={leaf.cy} rx={leaf.rx} ry={leaf.ry}
          fill={leaf.color === 'dark' ? `url(#${grad2Id})` : `url(#${gradId})`}
          opacity={leaf.color === 'dark' ? '0.75' : '0.85'} />
      ))}

      {/* Leaf veins */}
      {leaves.map((leaf, i) => (
        <line key={`vein-${i}`}
          x1={leaf.cx - leaf.rx * 0.4} y1={leaf.cy}
          x2={leaf.cx + leaf.rx * 0.4} y2={leaf.cy}
          stroke={palette.plantDark} strokeWidth="0.4" opacity="0.12" />
      ))}
    </g>
  )
}
