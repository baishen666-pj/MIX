import type { ThemePalette } from './themeColors'
import { TILE_SIZE, type RoomRect } from './PixelEngine'
import { TILES, type TileType, tilePalette } from './sprites/tileSprites'
import { FURNITURE_SPRITES, furniturePalette } from './sprites/furnitureSprites'
import { getCharacterSprite, getActivityBubble, roleColor, type SpriteMap } from './sprites/characterSprites'
import type { TeamRole } from '../../stores/app'
import type { AgentActivity } from './types'

function drawPixels(
  ctx: CanvasRenderingContext2D,
  sprite: number[][],
  x: number,
  y: number,
  palette: Record<number, string>,
  scale: number = 1
) {
  for (let row = 0; row < sprite.length; row++) {
    for (let col = 0; col < sprite[row].length; col++) {
      const idx = sprite[row][col]
      if (idx === 0) continue
      ctx.fillStyle = palette[idx] ?? '#f0f'
      ctx.fillRect(
        Math.floor(x + col * scale),
        Math.floor(y + row * scale),
        Math.ceil(scale),
        Math.ceil(scale)
      )
    }
  }
}

export function drawTile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  type: TileType,
  palette: ThemePalette
) {
  const tile = TILES[type]
  const tp = tilePalette(palette)
  // Draw tile scaled to TILE_SIZE
  const scaleX = TILE_SIZE / tile[0].length
  const scaleY = TILE_SIZE / tile.length
  const scale = Math.min(scaleX, scaleY)
  drawPixels(ctx, tile, x, y, tp, scale)
}

export function drawRoom(
  ctx: CanvasRenderingContext2D,
  rect: RoomRect,
  label: string,
  palette: ThemePalette,
  tileType: TileType = 'wood'
) {
  // Floor tiles
  const cols = Math.ceil(rect.w / TILE_SIZE)
  const rows = Math.ceil(rect.h / TILE_SIZE)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      drawTile(ctx, rect.x + c * TILE_SIZE, rect.y + r * TILE_SIZE, tileType, palette)
    }
  }

  // Wall border (2px thick)
  ctx.strokeStyle = palette.wallStroke
  ctx.lineWidth = 2
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h)

  // Inner wall highlight
  ctx.strokeStyle = palette.wallFill
  ctx.lineWidth = 1
  ctx.strokeRect(rect.x + 2, rect.y + 2, rect.w - 4, rect.h - 4)

  // Label
  if (label) {
    ctx.font = '10px system-ui'
    ctx.fillStyle = palette.floorStroke
    ctx.globalAlpha = 0.7
    ctx.textAlign = 'center'
    ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 4)
    ctx.globalAlpha = 1
  }
}

export function drawFurniture(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  type: string,
  palette: ThemePalette,
  scale: number = 2
) {
  const sprite = FURNITURE_SPRITES[type]
  if (!sprite) return
  const fp = furniturePalette(palette)
  drawPixels(ctx, sprite.data, x, y, fp, scale)
}

export function drawCharacter(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  role: TeamRole,
  activity: AgentActivity,
  animFrame: number,
  palette: ThemePalette,
  scale: number = 2
) {
  const rp = roleColor(role, palette)
  const sprite = getCharacterSprite(activity, animFrame)
  const spriteH = sprite.length * scale
  const spriteW = sprite[0].length * scale

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.1)'
  ctx.beginPath()
  ctx.ellipse(x + spriteW / 2, y + spriteH + 2, spriteW / 2.5, 3, 0, 0, Math.PI * 2)
  ctx.fill()

  // Character sprite
  drawPixels(ctx, sprite, x, y - 2, rp, scale)

  // Activity bubble
  const bubble = getActivityBubble(activity)
  if (bubble) {
    const bubblePalette: Record<number, string> = {
      0: 'transparent',
      5: palette.outline,
      9: palette.screenGlow,
    }
    const bx = x + spriteW - 4
    const by = y - 10
    drawPixels(ctx, bubble, bx, by, bubblePalette, 1)
  }
}

export function drawNameLabel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  name: string,
  color: string,
  isSelected: boolean
) {
  ctx.font = '9px system-ui'
  ctx.textAlign = 'center'
  const tw = ctx.measureText(name).width

  // Background
  ctx.fillStyle = isSelected ? color : 'rgba(0,0,0,0.5)'
  ctx.globalAlpha = 0.8
  const pad = 3
  ctx.fillRect(x - tw / 2 - pad, y, tw + pad * 2, 12)
  ctx.globalAlpha = 1

  // Text
  ctx.fillStyle = isSelected ? '#fff' : 'rgba(255,255,255,0.8)'
  ctx.fillText(name, x, y + 9)
}

export function drawApprovalGlow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  progress: number,
  palette: ThemePalette
) {
  const alpha = 0.15 + Math.sin(progress * 4) * 0.1
  ctx.strokeStyle = palette.glowColor
  ctx.lineWidth = 2
  ctx.globalAlpha = alpha
  ctx.beginPath()
  ctx.arc(x, y, 20 + Math.sin(progress * 3) * 5, 0, Math.PI * 2)
  ctx.stroke()
  ctx.globalAlpha = 1
}

export function drawWalkTrail(
  ctx: CanvasRenderingContext2D,
  positions: { x: number; z: number }[],
  palette: ThemePalette
) {
  for (let i = 0; i < positions.length; i++) {
    const alpha = 0.15 * (1 - i / positions.length)
    ctx.fillStyle = palette.floorStroke
    ctx.globalAlpha = alpha
    ctx.beginPath()
    ctx.arc(positions[i].x, positions[i].z, 2, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}
