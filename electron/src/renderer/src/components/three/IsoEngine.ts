const COS30 = Math.cos(Math.PI / 6)  // ~0.866
const SIN30 = Math.sin(Math.PI / 6)  // 0.5
const SCALE = 50 // pixels per world unit

export function toIso(x: number, z: number, y = 0): { x: number; y: number } {
  return {
    x: (x - z) * COS30 * SCALE,
    y: (x + z) * SIN30 * SCALE - y * SCALE
  }
}

export function sortKey(x: number, y: number, z: number): number {
  return (x + z) * 1000 + y
}

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

export interface IsoPoint { x: number; y: number }

export function roomCorners(
  cx: number, cz: number,
  w: number, d: number
): IsoPoint[] {
  const hw = w / 2, hd = d / 2
  return [
    toIso(cx - hw, cz - hd), // back-left
    toIso(cx + hw, cz - hd), // back-right
    toIso(cx + hw, cz + hd), // front-right
    toIso(cx - hw, cz + hd), // front-left
  ]
}

export function wallPolygon(
  p1: IsoPoint, p2: IsoPoint, height: number
): string {
  const h = height * SCALE
  return `${p1.x},${p1.y} ${p2.x},${p2.y} ${p2.x},${p2.y - h} ${p1.x},${p1.y - h}`
}

export function floorPolygon(corners: IsoPoint[]): string {
  return corners.map((c) => `${c.x},${c.y}`).join(' ')
}

export { COS30, SIN30, SCALE }
