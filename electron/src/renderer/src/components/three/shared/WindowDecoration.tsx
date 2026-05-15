import type { IsoPoint } from '../IsoEngine'
import type { ThemePalette } from '../themeColors'

interface WindowDecorationProps {
  p1: IsoPoint; p2: IsoPoint
  palette: ThemePalette; theme: string; gradId: string
  variant?: 'single' | 'double'
}

export function WindowDecoration({ p1, p2, palette, theme, gradId, variant = 'single' }: WindowDecorationProps) {
  const midX = (p1.x + p2.x) / 2
  const midY = (p1.y + p2.y) / 2

  if (variant === 'double') {
    const top = midY - 42
    const winW = 22, winH = 28, gap = 6

    return (
      <g>
        {theme === 'light' && (
          <rect x={midX - winW - gap / 2 - 4} y={top - 4}
            width={winW * 2 + gap + 8} height={winH + 8} rx="4"
            fill="#fef9c3" opacity="0.1" />
        )}
        {/* Window light glow */}
        <rect x={midX - winW - gap / 2 - 8} y={top - 6}
          width={winW * 2 + gap + 16} height={winH + 12} rx="6"
          fill={palette.ambientLight} opacity={palette.ambientOpacity} />
        {/* Left window */}
        <rect x={midX - winW - gap / 2} y={top} width={winW} height={winH} rx="2"
          fill={`url(#${gradId})`} stroke={palette.windowStroke} strokeWidth="1.5" opacity={0.65} />
        <line x1={midX - gap / 2} y1={top} x2={midX - gap / 2} y2={top + winH}
          stroke={palette.windowStroke} strokeWidth="1" opacity={0.5} />
        <line x1={midX - winW - gap / 2} y1={top + winH / 2} x2={midX - gap / 2} y2={top + winH / 2}
          stroke={palette.windowStroke} strokeWidth="1" opacity={0.5} />
        {/* Right window */}
        <rect x={midX + gap / 2} y={top} width={winW} height={winH} rx="2"
          fill={`url(#${gradId})`} stroke={palette.windowStroke} strokeWidth="1.5" opacity={0.65} />
        <line x1={midX + winW / 2 + gap / 2} y1={top} x2={midX + winW / 2 + gap / 2} y2={top + winH}
          stroke={palette.windowStroke} strokeWidth="1" opacity="0.5" />
        <line x1={midX + gap / 2} y1={top + winH / 2} x2={midX + winW + gap / 2} y2={top + winH / 2}
          stroke={palette.windowStroke} strokeWidth="1" opacity="0.5" />
        {/* Curtains */}
        <path d={`M${midX - winW - gap / 2},${top} Q${midX - winW - gap / 2 - 7},${top + winH * 0.4} ${midX - winW - gap / 2 + 2},${top + winH}`}
          fill={palette.wallFill} opacity={0.3} stroke="none" />
        <path d={`M${midX + winW + gap / 2},${top} Q${midX + winW + gap / 2 + 7},${top + winH * 0.4} ${midX + winW + gap / 2 - 2},${top + winH}`}
          fill={palette.wallFill} opacity={0.3} stroke="none" />
        <path d={`M${midX - gap / 2},${top} Q${midX},${top + winH * 0.3} ${midX + gap / 2},${top}`}
          fill={palette.wallFill} opacity={0.2} stroke="none" />
        {/* Light cone to floor */}
        <polygon
          points={`${midX - winW + 4},${top + winH} ${midX + winW + gap - 4},${top + winH} ${midX + 8},${top + winH + 40} ${midX - 8},${top + winH + 40}`}
          fill={palette.ambientLight} opacity="0.04" />
      </g>
    )
  }

  // Single window
  const w = 40, h = 25
  const top = midY - h - 8

  return (
    <g>
      {theme === 'light' && (
        <rect x={midX - w / 2 - 4} y={top - 4} width={w + 8} height={h + 8} rx="4"
          fill="#fef9c3" opacity="0.1" />
      )}
      {/* Window light glow */}
      <rect x={midX - w / 2 - 6} y={top - 4} width={w + 12} height={h + 8} rx="5"
        fill={palette.ambientLight} opacity={palette.ambientOpacity} />
      {/* Window frame */}
      <rect x={midX - w / 2} y={top} width={w} height={h} rx="2"
        fill={`url(#${gradId})`} stroke={palette.windowStroke} strokeWidth="1.5" opacity={0.65} />
      {/* Cross bars */}
      <line x1={midX} y1={top} x2={midX} y2={top + h}
        stroke={palette.windowStroke} strokeWidth="1" opacity={0.5} />
      <line x1={midX - w / 2} y1={top + h / 2} x2={midX + w / 2} y2={top + h / 2}
        stroke={palette.windowStroke} strokeWidth="1" opacity={0.5} />
      {/* Curtains */}
      <path d={`M${midX - w / 2},${top} Q${midX - w / 2 - 6},${top + h * 0.4} ${midX - w / 2 + 2},${top + h}`}
        fill={palette.wallFill} opacity={0.3} stroke="none" />
      <path d={`M${midX + w / 2},${top} Q${midX + w / 2 + 6},${top + h * 0.4} ${midX + w / 2 - 2},${top + h}`}
        fill={palette.wallFill} opacity={0.3} stroke="none" />
      {/* Light cone projecting to floor */}
      <polygon
        points={`${midX - w / 2 + 8},${top + h} ${midX + w / 2 - 8},${top + h} ${midX + 6},${top + h + 50} ${midX - 6},${top + h + 50}`}
        fill={palette.ambientLight} opacity="0.04" />
    </g>
  )
}
