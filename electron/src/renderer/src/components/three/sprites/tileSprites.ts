import type { ThemePalette } from '../themeColors'

export function tilePalette(p: ThemePalette): Record<number, string> {
  return {
    0: p.floorFill,
    1: p.floorStroke,
    2: p.wallFill,
    3: p.wallStroke,
    4: p.ambientLight,
  }
}

// 32x32 wood floor tile
export const WOOD_TILE: number[][] = (() => {
  const t: number[][] = Array.from({ length: 32 }, () => Array(32).fill(0))
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      // Wood plank lines every 8 pixels
      if (y % 8 === 0) t[y][x] = 1
      // Vertical plank separators offset by row
      if ((x + (Math.floor(y / 8) % 2) * 16) % 32 === 0) t[y][x] = 1
    }
  }
  return t
})()

// 32x32 tile floor (checkerboard)
export const TILE_FLOOR: number[][] = (() => {
  const t: number[][] = Array.from({ length: 32 }, (_, y) =>
    Array.from({ length: 32 }, (__, x) =>
      (Math.floor(x / 16) + Math.floor(y / 16)) % 2 === 0 ? 0 : 1
    )
  )
  return t
})()

// 32x32 carpet tile
export const CARPET_TILE: number[][] = (() => {
  const t: number[][] = Array.from({ length: 32 }, () => Array(32).fill(0))
  // Carpet texture: scattered dots
  for (let y = 0; y < 32; y += 4) {
    for (let x = 0; x < 32; x += 4) {
      if ((x + y) % 8 === 0) t[y + 1][x + 1] = 1
    }
  }
  return t
})()

export const TILES = { wood: WOOD_TILE, tile: TILE_FLOOR, carpet: CARPET_TILE }
export type TileType = keyof typeof TILES
