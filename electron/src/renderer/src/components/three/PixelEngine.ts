export const TILE_SIZE = 32

export interface ScreenPoint {
  x: number
  y: number
}

export interface GridPoint {
  x: number
  z: number
}

export interface RoomRect {
  x: number
  y: number
  w: number
  h: number
}

export function toScreen(gridX: number, gridZ: number): ScreenPoint {
  return { x: gridX * TILE_SIZE, y: gridZ * TILE_SIZE }
}

export function screenToGrid(screenX: number, screenY: number): GridPoint {
  return {
    x: Math.round(screenX / TILE_SIZE),
    z: Math.round(screenY / TILE_SIZE)
  }
}

export function sortKey(x: number, z: number): number {
  return z * 10000 + x
}

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

export function roomRect(cx: number, cz: number, w: number, d: number): RoomRect {
  const screen = toScreen(cx, cz)
  return {
    x: screen.x - (w * TILE_SIZE) / 2,
    y: screen.y - (d * TILE_SIZE) / 2,
    w: w * TILE_SIZE,
    h: d * TILE_SIZE
  }
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
