import { toIso } from '../IsoEngine'
import { usePalette } from '../PaletteContext'

interface AmbientParticlesProps {
  cx: number
  cz: number
  width: number
  depth: number
}

const PARTICLE_COUNT = 18

// Deterministic pseudo-random from seed
function seededRand(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453
  return x - Math.floor(x)
}

export function AmbientParticles({ cx, cz, width, depth }: AmbientParticlesProps) {
  const { palette } = usePalette()

  const particles = Array.from({ length: PARTICLE_COUNT }, (_, i) => {
    const seed = i + cx * 7 + cz * 13
    const rx = (seededRand(seed) - 0.5) * width * 0.8
    const rz = (seededRand(seed + 100) - 0.5) * depth * 0.8
    const pos = toIso(cx + rx, cz + rz)
    const size = 1 + seededRand(seed + 200) * 2
    const dur = 6 + seededRand(seed + 300) * 8
    const delay = seededRand(seed + 400) * dur
    const yStart = seededRand(seed + 500) * 20 - 10
    const opacity = 0.06 + seededRand(seed + 600) * 0.08

    return (
      <g key={`p-${cx}-${cz}-${i}`}>
        <circle
          cx={pos.x} cy={pos.y + yStart}
          r={size}
          fill={palette.ambientLight}
          opacity={opacity}
        >
          <animate
            attributeName="cy"
            from={pos.y + yStart}
            to={pos.y + yStart - 25}
            dur={`${dur}s`}
            begin={`${delay}s`}
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values={`${opacity};${opacity * 0.3};${opacity}`}
            dur={`${dur * 0.7}s`}
            begin={`${delay}s`}
            repeatCount="indefinite"
          />
        </circle>
      </g>
    )
  })

  return <g>{particles}</g>
}
