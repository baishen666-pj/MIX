import { roomCorners, wallPolygon, floorPolygon, toIso } from './IsoEngine'
import { usePalette } from './PaletteContext'
import { FloorGrid } from './shared/FloorGrid'
import { WindowDecoration } from './shared/WindowDecoration'
import { WallArt } from './shared/WallArt'
import { RoomDefs } from './shared/RoomDefs'

const WALL_H = 2.5
const BASEBOARD_H = 3

export function IsoRoom({ cx, cz, width, depth, label }: {
  cx: number; cz: number; width: number; depth: number; label?: string
}) {
  const { palette, theme } = usePalette()
  const [bl, br, fr, fl] = roomCorners(cx, cz, width, depth)

  const gradId = `floorGrad-${cx}-${cz}`
  const tileId = `tile-${cx}-${cz}`
  const winGradId = `winGrad-${cx}-${cz}`
  const lightId = `lightCone-${cx}-${cz}`

  const wallTopY = bl.y - WALL_H * 50

  // Wall texture lines
  const backWallTexture = Array.from({ length: 4 }, (_, i) => {
    const y = wallTopY + (bl.y - wallTopY) * (0.2 + i * 0.22)
    return (
      <line key={`bt-${i}`} x1={bl.x + 2} y1={y} x2={br.x - 2} y2={y}
        stroke={palette.wallAccent} strokeWidth="0.5" opacity="0.06" />
    )
  })

  const leftWallTexture = Array.from({ length: 4 }, (_, i) => {
    const ratio = 0.2 + i * 0.22
    const x1 = bl.x + (fl.x - bl.x) * ratio
    const y1 = wallTopY + (bl.y - wallTopY) * ratio
    const x2 = x1 + 10
    const y2 = y1
    return (
      <line key={`lt-${i}`} x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={palette.wallAccent} strokeWidth="0.5" opacity="0.05" />
    )
  })

  // Floor highlight (window light)
  const floorCenter = toIso(cx, cz)
  const lightConePath = (() => {
    const winMidX = (bl.x + br.x) / 2
    const winMidY = bl.y
    const spreadW = (br.x - bl.x) * 0.35
    const coneLen = (fr.y - bl.y) * 0.5
    return `M${winMidX - spreadW},${winMidY}
            L${winMidX + spreadW},${winMidY}
            L${winMidX + spreadW * 0.4},${winMidY + coneLen}
            L${winMidX - spreadW * 0.4},${winMidY + coneLen} Z`
  })()

  // Corner shadow
  const cornerShadow = (() => {
    const size = 12
    return `M${bl.x},${bl.y}
            L${bl.x + size},${bl.y}
            L${bl.x},${bl.y - size} Z`
  })()

  // Label background
  const labelX = (bl.x + fr.x) / 2
  const labelY = (bl.y + fr.y) / 2 + 5
  const labelW = label ? label.length * 6.5 + 16 : 0

  return (
    <g>
      <RoomDefs gradId={gradId} tileId={tileId} winGradId={winGradId} lightId={lightId} palette={palette} />

      {/* ---- BACK WALL ---- */}
      <polygon
        points={wallPolygon(bl, br, WALL_H)}
        fill={palette.wallFill} stroke={palette.wallStroke} strokeWidth="1.5"
        opacity={0.8}
      />
      {/* Wall texture lines */}
      {backWallTexture}
      {/* Top edge highlight */}
      <line x1={bl.x} y1={wallTopY} x2={br.x} y2={wallTopY}
        stroke="white" strokeWidth="1" opacity="0.04" />
      {/* Baseboard: outer */}
      <polygon
        points={`${bl.x},${bl.y} ${br.x},${br.y} ${br.x},${br.y - BASEBOARD_H} ${bl.x},${bl.y - BASEBOARD_H}`}
        fill={palette.woodDark} opacity="0.25"
      />
      {/* Baseboard: inner line */}
      <line x1={bl.x + 1} y1={bl.y - BASEBOARD_H + 1} x2={br.x - 1} y2={br.y - BASEBOARD_H + 1}
        stroke={palette.woodLight} strokeWidth="0.5" opacity="0.15" />

      {/* ---- LEFT WALL ---- */}
      <polygon
        points={wallPolygon(bl, fl, WALL_H)}
        fill={palette.wallFill2} stroke={palette.wallStroke} strokeWidth="1.5"
        opacity={0.6}
      />
      {/* Wall texture lines */}
      {leftWallTexture}
      {/* Top edge highlight */}
      <line x1={bl.x} y1={wallTopY} x2={fl.x} y2={fl.y - WALL_H * 50}
        stroke="white" strokeWidth="1" opacity="0.04" />
      {/* Baseboard: outer */}
      <polygon
        points={`${bl.x},${bl.y} ${fl.x},${fl.y} ${fl.x},${fl.y - BASEBOARD_H} ${bl.x},${bl.y - BASEBOARD_H}`}
        fill={palette.woodDark} opacity="0.25"
      />
      {/* Baseboard: inner line */}
      <line x1={bl.x + 1} y1={bl.y - BASEBOARD_H + 1} x2={fl.x - 1} y2={fl.y - BASEBOARD_H + 1}
        stroke={palette.woodLight} strokeWidth="0.5" opacity="0.15" />

      {/* ---- CORNER SHADOW ---- */}
      <polygon points={cornerShadow} fill={palette.shadowOpacity === '0.2' ? '#000' : '#000'} opacity="0.06" />

      {/* ---- FLOOR ---- */}
      <polygon points={floorPolygon([bl, br, fr, fl])}
        fill={palette.floorFill} stroke={palette.wallStroke} strokeWidth="1.5" />
      {/* Floor gradient overlay */}
      <polygon points={floorPolygon([bl, br, fr, fl])}
        fill={`url(#${gradId})`} />
      {/* Floor tile pattern */}
      <polygon points={floorPolygon([bl, br, fr, fl])}
        fill={`url(#${tileId})`} />
      {/* Floor highlight (window light reflection) */}
      <polygon points={lightConePath}
        fill={`url(#${lightId})`} />

      <FloorGrid cx={cx} cz={cz} width={width} depth={depth} color={palette.floorStroke} />

      {/* Room label with background */}
      {label && (
        <g>
          <rect x={labelX - labelW / 2} y={labelY - 10} width={labelW} height="16" rx="4"
            fill={palette.floorFill} opacity="0.7" />
          <rect x={labelX - labelW / 2} y={labelY - 10} width={labelW} height="16" rx="4"
            fill="none" stroke={palette.floorStroke} strokeWidth="0.5" opacity="0.3" />
          <text x={labelX} y={labelY + 1}
            textAnchor="middle" fontSize="10" fontFamily="system-ui" fontWeight="500"
            fill={palette.floorStroke} opacity="0.6">
            {label}
          </text>
        </g>
      )}

      {/* Window on back wall */}
      <WindowDecoration p1={bl} p2={br} palette={palette} theme={theme} gradId={winGradId} />

      {/* Wall art on back wall (left side) */}
      <WallArt p1={bl} p2={br} palette={palette} offsetRatio={-0.25}
        artW={16} artH={12} yOffset={55} opacity={0.6} innerOpacity={0.15} />

      {/* Wall art on left wall */}
      <WallArt p1={bl} p2={fl} palette={palette} offsetRatio={-0.1}
        artW={12} artH={16} yOffset={55} opacity={0.5} innerOpacity={0.12} />
    </g>
  )
}
