import { roomCorners, wallPolygon, floorPolygon, toIso, type IsoPoint } from './IsoEngine'
import { IsoMonitor, IsoChair, IsoPlant } from './IsoFurniture'
import { usePalette } from './PaletteContext'
import type { ThemePalette } from './themeColors'
import { FloorGrid } from './shared/FloorGrid'
import { WindowDecoration } from './shared/WindowDecoration'
import { WallArt } from './shared/WallArt'
import { RoomDefs } from './shared/RoomDefs'

const BOSS_CX = 0
const BOSS_CZ = -8
const BOSS_W = 12
const BOSS_D = 10
const WALL_H = 3
const BASEBOARD_H = 5

function getBossColors(palette: ThemePalette) {
  return {
    floor: palette.floorFill,
    wall: palette.wallFill,
    wall2: palette.wallFill2,
    stroke: palette.wallStroke,
    label: palette.glowColor,
    whiteboard: palette.topFill,
    whiteboardStroke: palette.wallStroke,
  }
}

export function IsoBossOffice() {
  const { palette, theme } = usePalette()
  const boss = getBossColors(palette)
  const [bl, br, fr, fl] = roomCorners(BOSS_CX, BOSS_CZ, BOSS_W, BOSS_D)

  const gradId = `bossFloorGrad`
  const tileId = `bossTile`
  const winGradId = `bossWinGrad`
  const lightId = `bossLightCone`

  const wallTopY = bl.y - WALL_H * 50

  // Wall texture lines
  const backWallTexture = Array.from({ length: 5 }, (_, i) => {
    const y = wallTopY + (bl.y - wallTopY) * (0.15 + i * 0.18)
    return (
      <line key={`bbt-${i}`} x1={bl.x + 2} y1={y} x2={br.x - 2} y2={y}
        stroke={palette.wallAccent} strokeWidth="0.5" opacity="0.06" />
    )
  })

  const leftWallTexture = Array.from({ length: 5 }, (_, i) => {
    const ratio = 0.15 + i * 0.18
    const x1 = bl.x + (fl.x - bl.x) * ratio
    const y1 = wallTopY + (bl.y - wallTopY) * ratio
    return (
      <line key={`blt-${i}`} x1={x1} y1={y1} x2={x1 + 12} y2={y1}
        stroke={palette.wallAccent} strokeWidth="0.5" opacity="0.05" />
    )
  })

  // Corner shadow
  const cornerShadow = `M${bl.x},${bl.y} L${bl.x + 14},${bl.y} L${bl.x},${bl.y - 14} Z`

  // Light cone on floor from window
  const lightConePath = (() => {
    const winMidX = (bl.x + br.x) / 2
    const spreadW = (br.x - bl.x) * 0.35
    const coneLen = (fr.y - bl.y) * 0.45
    return `M${winMidX - spreadW},${bl.y}
            L${winMidX + spreadW},${bl.y}
            L${winMidX + spreadW * 0.35},${bl.y + coneLen}
            L${winMidX - spreadW * 0.35},${bl.y + coneLen} Z`
  })()

  // Label
  const labelX = (bl.x + fr.x) / 2
  const labelY = (bl.y + fr.y) / 2 + 8

  return (
    <g>
      <RoomDefs gradId={gradId} tileId={tileId} winGradId={winGradId} lightId={lightId} palette={palette} floorColor={boss.floor} />

      {/* ---- BACK WALL ---- */}
      <polygon points={wallPolygon(bl, br, WALL_H)}
        fill={boss.wall} stroke={boss.stroke} strokeWidth="2" opacity={0.75} />
      {backWallTexture}
      <line x1={bl.x} y1={wallTopY} x2={br.x} y2={wallTopY}
        stroke="white" strokeWidth="1" opacity="0.04" />
      {/* Baseboard: outer */}
      <polygon
        points={`${bl.x},${bl.y} ${br.x},${br.y} ${br.x},${br.y - BASEBOARD_H} ${bl.x},${bl.y - BASEBOARD_H}`}
        fill={palette.woodDark} opacity="0.25"
      />
      {/* Baseboard: inner line */}
      <line x1={bl.x + 1} y1={bl.y - BASEBOARD_H + 1} x2={br.x - 1} y2={br.y - BASEBOARD_H + 1}
        stroke={palette.woodLight} strokeWidth="0.5" opacity="0.12" />

      {/* ---- LEFT WALL ---- */}
      <polygon points={wallPolygon(bl, fl, WALL_H)}
        fill={boss.wall2} stroke={boss.stroke} strokeWidth="2" opacity={0.55} />
      {leftWallTexture}
      <line x1={bl.x} y1={wallTopY} x2={fl.x} y2={fl.y - WALL_H * 50}
        stroke="white" strokeWidth="1" opacity="0.04" />
      <polygon
        points={`${bl.x},${bl.y} ${fl.x},${fl.y} ${fl.x},${fl.y - BASEBOARD_H} ${bl.x},${bl.y - BASEBOARD_H}`}
        fill={palette.woodDark} opacity="0.25"
      />
      <line x1={bl.x + 1} y1={bl.y - BASEBOARD_H + 1} x2={fl.x - 1} y2={fl.y - BASEBOARD_H + 1}
        stroke={palette.woodLight} strokeWidth="0.5" opacity="0.12" />

      {/* Corner shadow */}
      <polygon points={cornerShadow} fill="#000" opacity="0.06" />

      {/* ---- FLOOR ---- */}
      <polygon points={floorPolygon([bl, br, fr, fl])}
        fill={boss.floor} stroke={boss.stroke} strokeWidth="2" />
      <polygon points={floorPolygon([bl, br, fr, fl])}
        fill={`url(#${gradId})`} />
      <polygon points={floorPolygon([bl, br, fr, fl])}
        fill={`url(#${tileId})`} />
      {/* Light cone from window */}
      <polygon points={lightConePath}
        fill={`url(#${lightId})`} />

      <FloorGrid cx={BOSS_CX} cz={BOSS_CZ} width={BOSS_W} depth={BOSS_D} color={palette.floorStroke} keyPrefix="b" />

      {/* Whiteboard on back wall */}
      <Whiteboard p1={bl} p2={br} palette={palette} fillColor={boss.whiteboard} strokeColor={boss.whiteboardStroke} />

      {/* Company logo on back wall top */}
      <CompanyLogo p1={bl} p2={br} palette={palette} />

      {/* Wall art on left wall */}
      <WallArt p1={bl} p2={fl} palette={palette} offsetRatio={-0.1}
        artW={14} artH={18} yOffset={65} opacity={0.5} innerOpacity={0.15} />

      {/* Boss desk shadow on floor */}
      <polygon
        points="-30,-14 30,-14 37,2 -23,2"
        fill={palette.woodDark} opacity="0.08"
        transform={`translate(${toIso(BOSS_CX, BOSS_CZ - 2).x},${toIso(BOSS_CX, BOSS_CZ - 2).y + 4})`}
      />

      {/* Boss desk */}
      <g transform={`translate(${toIso(BOSS_CX, BOSS_CZ - 2).x},${toIso(BOSS_CX, BOSS_CZ - 2).y})`}>
        {/* Right face */}
        <polygon points="28,-32 35,-16 35,0 28,-16"
          fill={palette.woodDark} stroke={palette.woodDark} strokeWidth="1" opacity="0.85" />
        {/* Front face */}
        <polygon points="-21,-16 35,-16 35,0 -21,0"
          fill={palette.woodMid} stroke={palette.woodDark} strokeWidth="1" />
        {/* Front face grain */}
        <line x1="-19" y1="-10" x2="33" y2="-10"
          stroke={palette.woodDark} strokeWidth="0.4" opacity="0.12" />
        <line x1="-19" y1="-5" x2="33" y2="-5"
          stroke={palette.woodDark} strokeWidth="0.4" opacity="0.08" />
        {/* Drawers */}
        <rect x="-16" y="-12" width="22" height="8" rx="1"
          fill={palette.woodDark} opacity="0.5" />
        <rect x="6" y="-12" width="22" height="8" rx="1"
          fill={palette.woodDark} opacity="0.5" />
        {/* Drawer inner shadow */}
        <line x1="-14" y1="-11.5" x2="4" y2="-11.5" stroke="#000" strokeWidth="0.3" opacity="0.1" />
        <line x1="8" y1="-11.5" x2="26" y2="-11.5" stroke="#000" strokeWidth="0.3" opacity="0.1" />
        {/* Drawer handles */}
        <line x1="-8" y1="-8" x2="-2" y2="-8" stroke={palette.metalLight} strokeWidth="1.2" />
        <line x1="14" y1="-8" x2="20" y2="-8" stroke={palette.metalLight} strokeWidth="1.2" />
        {/* Top face */}
        <polygon points="-28,-32 28,-32 35,-16 -21,-16"
          fill={palette.woodLight} stroke={palette.woodDark} strokeWidth="1.5" />
        {/* Top face grain */}
        <line x1="-24" y1="-29" x2="24" y2="-29" stroke={palette.woodDark} strokeWidth="0.5" opacity="0.08" />
        <line x1="-22" y1="-25" x2="28" y2="-25" stroke={palette.woodDark} strokeWidth="0.5" opacity="0.08" />
        <line x1="-21" y1="-20" x2="31" y2="-20" stroke={palette.woodDark} strokeWidth="0.5" opacity="0.08" />
        {/* Top face highlight */}
        <line x1="-28" y1="-32" x2="28" y2="-32"
          stroke={palette.metalLight} strokeWidth="0.8" opacity={0.2} />
        {/* Edge highlight */}
        <line x1="-21" y1="-16" x2="35" y2="-16"
          stroke="white" strokeWidth="1" opacity="0.15" />
      </g>

      <IsoMonitor x={BOSS_CX} z={BOSS_CZ - 2.5} />
      <IsoChair x={BOSS_CX} z={BOSS_CZ} />
      <IsoPlant x={BOSS_CX - 4} z={BOSS_CZ + 3} />
      <IsoPlant x={BOSS_CX + 4} z={BOSS_CZ + 3} />

      {/* Label with background */}
      <g>
        <rect x={labelX - 40} y={labelY - 12} width="80" height="18" rx="4"
          fill={palette.floorFill} opacity="0.7" />
        <rect x={labelX - 40} y={labelY - 12} width="80" height="18" rx="4"
          fill="none" stroke={palette.floorStroke} strokeWidth="0.5" opacity="0.3" />
        <text x={labelX} y={labelY + 1}
          textAnchor="middle" fontSize="11" fontFamily="system-ui" fontWeight="600"
          fill={boss.label} opacity={0.6}>
          老板办公室
        </text>
      </g>

      {/* Double window on back wall */}
      <WindowDecoration p1={bl} p2={br} palette={palette} theme={theme} gradId={winGradId} variant="double" />
    </g>
  )
}

function Whiteboard({ p1, p2, palette, fillColor, strokeColor }: {
  p1: IsoPoint; p2: IsoPoint
  palette: ThemePalette; fillColor: string; strokeColor: string
}) {
  const midX = (p1.x + p2.x) / 2
  const midY = (p1.y + p2.y) / 2
  const wbW = 50, wbH = 30
  const top = midY - wbH - 30

  return (
    <g>
      {/* Shadow behind whiteboard */}
      <rect x={midX - wbW / 2 + 2} y={top + 2} width={wbW} height={wbH} rx="2"
        fill="#000" opacity="0.05" />
      {/* Whiteboard body */}
      <rect x={midX - wbW / 2} y={top} width={wbW} height={wbH} rx="2"
        fill={fillColor} stroke={strokeColor} strokeWidth="1.5" opacity={0.8} />
      {/* Content lines */}
      <line x1={midX - wbW / 2 + 5} y1={top + 7} x2={midX + 10} y2={top + 7}
        stroke={palette.floorStroke} strokeWidth="1.5" opacity="0.35" />
      <line x1={midX - wbW / 2 + 5} y1={top + 12} x2={midX + 5} y2={top + 12}
        stroke={palette.floorStroke} strokeWidth="1.5" opacity="0.3" />
      <line x1={midX - wbW / 2 + 5} y1={top + 17} x2={midX + 12} y2={top + 17}
        stroke={palette.floorStroke} strokeWidth="1.5" opacity="0.25" />
      <line x1={midX - wbW / 2 + 5} y1={top + 22} x2={midX + 2} y2={top + 22}
        stroke={palette.floorStroke} strokeWidth="1.5" opacity="0.2" />
      {/* Post-it note */}
      <rect x={midX + 10} y={top + 7} width={wbW / 2 - 16} height={12} rx="1"
        fill={palette.metalLight} opacity="0.18" />
      {/* Pen tray */}
      <rect x={midX - 15} y={top + wbH} width="30" height="3" rx="1"
        fill={strokeColor} opacity="0.4" />
      {/* Whiteboard edge highlight */}
      <rect x={midX - wbW / 2} y={top} width={wbW} height="1" rx="0.5"
        fill="white" opacity="0.08" />
    </g>
  )
}

function CompanyLogo({ p1, p2, palette }: {
  p1: IsoPoint; p2: IsoPoint; palette: ThemePalette
}) {
  const midX = (p1.x + p2.x) / 2
  const midY = (p1.y + p2.y) / 2
  const logoTop = midY - WALL_H * 50 + 5

  return (
    <g>
      {/* Logo background glow */}
      <rect x={midX - 12} y={logoTop - 2} width="24" height="14" rx="3"
        fill={palette.glowColor} opacity="0.15" />
      {/* Logo background */}
      <rect x={midX - 10} y={logoTop} width="20" height="10" rx="2"
        fill={palette.glowColor} opacity="0.45" />
      {/* Diamond shape */}
      <polygon
        points={`${midX},${logoTop + 2} ${midX + 4},${logoTop + 5} ${midX},${logoTop + 8} ${midX - 4},${logoTop + 5}`}
        fill={palette.topFill} opacity="0.6"
      />
    </g>
  )
}

export const BOSS_POSITION = { x: BOSS_CX, z: BOSS_CZ } as const
