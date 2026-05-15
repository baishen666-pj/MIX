import type { JSX } from 'react'
import { toIso } from '../IsoEngine'

export function FloorGrid({ cx, cz, width, depth, color, keyPrefix = '' }: {
  cx: number; cz: number; width: number; depth: number; color: string; keyPrefix?: string
}): JSX.Element {
  const lines: JSX.Element[] = []
  const step = 2
  for (let x = cx - width / 2 + step; x < cx + width / 2; x += step) {
    const a = toIso(x, cz - depth / 2)
    const b = toIso(x, cz + depth / 2)
    lines.push(
      <line key={`${keyPrefix}vx${x}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
        stroke={color} strokeWidth="0.5" opacity={0.1}
        strokeDasharray="3 3" />
    )
  }
  for (let z = cz - depth / 2 + step; z < cz + depth / 2; z += step) {
    const a = toIso(cx - width / 2, z)
    const b = toIso(cx + width / 2, z)
    lines.push(
      <line key={`${keyPrefix}hz${z}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
        stroke={color} strokeWidth="0.5" opacity={0.1}
        strokeDasharray="3 3" />
    )
  }
  return <g>{lines}</g>
}
