import { toIso } from '../IsoEngine'
import { usePalette } from '../PaletteContext'

export function IsoRoundTable({ x, z }: { x: number; z: number }) {
  const pos = toIso(x, z)
  const { palette } = usePalette()

  const topCY = -20
  const sideH = 8
  const rx = 20, ry = 10

  return (
    <g transform={`translate(${pos.x},${pos.y})`}>
      {/* Ground shadow */}
      <ellipse cx="0" cy={topCY + ry + 22} rx="17" ry="5.5"
        fill="rgba(0,0,0,0.07)" filter="url(#furniture-shadow)" />

      {/* Center column */}
      <rect x="-3" y={topCY + ry - 2} width="6" height="14"
        fill={palette.woodMid} stroke={palette.woodDark} strokeWidth="0.5" />
      {/* Column highlight */}
      <line x1="-1" y1={topCY + ry} x2="-1" y2={topCY + ry + 10}
        stroke="white" strokeWidth="0.5" opacity="0.08" />
      {/* 3 feet */}
      <line x1="0" y1={topCY + ry + 12} x2="-8" y2={topCY + ry + 18}
        stroke={palette.woodDark} strokeWidth="2" />
      <line x1="0" y1={topCY + ry + 12} x2="8" y2={topCY + ry + 18}
        stroke={palette.woodDark} strokeWidth="2" />
      <line x1="0" y1={topCY + ry + 12} x2="0" y2={topCY + ry + 19}
        stroke={palette.woodDark} strokeWidth="2" />

      {/* Side arc (visible rim thickness) */}
      <path
        d={`M${rx},${topCY} A${rx},${ry} 0 0 1 ${-rx},${topCY}
           L${-rx},${topCY + sideH} A${rx},${ry} 0 0 0 ${rx},${topCY + sideH} Z`}
        fill={palette.woodDark} opacity="0.5"
      />

      {/* Top ellipse (table surface) */}
      <ellipse cx="0" cy={topCY} rx={rx} ry={ry}
        fill={palette.woodLight} stroke={palette.woodDark} strokeWidth="1.5" />

      {/* Wood grain arcs (more natural) */}
      <path d={`M${-rx * 0.6},${topCY - 3} A${rx * 0.6},${ry * 0.6} 0 0 1 ${rx * 0.6},${topCY - 3}`}
        fill="none" stroke={palette.woodDark} strokeWidth="0.6" opacity="0.08" />
      <path d={`M${-rx * 0.5},${topCY - 1} A${rx * 0.5},${ry * 0.5} 0 0 1 ${rx * 0.5},${topCY - 1}`}
        fill="none" stroke={palette.woodDark} strokeWidth="0.6" opacity="0.1" />
      <path d={`M${-rx * 0.3},${topCY + 3} A${rx * 0.3},${ry * 0.3} 0 0 1 ${rx * 0.3},${topCY + 3}`}
        fill="none" stroke={palette.woodDark} strokeWidth="0.6" opacity="0.1" />
      <path d={`M${-rx * 0.2},${topCY + 5} A${rx * 0.2},${ry * 0.2} 0 0 1 ${rx * 0.2},${topCY + 5}`}
        fill="none" stroke={palette.woodDark} strokeWidth="0.5" opacity="0.07" />

      {/* Edge highlight on top ellipse (front arc) */}
      <path d={`M${-rx + 3},${topCY} A${rx},${ry} 0 0 0 ${rx - 3},${topCY}`}
        fill="none" stroke="white" strokeWidth="1.2" opacity="0.18" />
      {/* Top surface subtle highlight */}
      <ellipse cx="-3" cy={topCY - 2} rx={rx * 0.6} ry={ry * 0.4}
        fill="white" opacity="0.03" />
    </g>
  )
}
