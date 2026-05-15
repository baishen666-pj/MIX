import type { IsoPoint } from '../IsoEngine'
import type { ThemePalette } from '../themeColors'

interface WallArtProps {
  p1: IsoPoint; p2: IsoPoint
  palette: ThemePalette
  offsetRatio?: number
  artW?: number
  artH?: number
  yOffset?: number
  opacity?: number
  innerOpacity?: number
}

export function WallArt({
  p1, p2, palette,
  offsetRatio = 0.25,
  artW = 16, artH = 12,
  yOffset = 55,
  opacity = 0.5,
  innerOpacity = 0.15,
}: WallArtProps) {
  const posX = p1.x + (p2.x - p1.x) * (0.5 + offsetRatio)
  const posY = p1.y + (p2.y - p1.y) * (0.5 + offsetRatio)
  const top = posY - yOffset

  return (
    <g>
      <rect x={posX - artW / 2} y={top} width={artW} height={artH} rx="1"
        fill={palette.topFill} stroke={palette.wallStroke} strokeWidth="0.8" opacity={opacity} />
      <rect x={posX - artW / 2 + 2} y={top + 2} width={artW - 4} height={artH - 4} rx="0.5"
        fill={palette.metalLight} opacity={innerOpacity} />
    </g>
  )
}
