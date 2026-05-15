import { getPalette } from '../themeColors'
import type { Expression } from '../IsoCharacterAnimation'

type Palette = ReturnType<typeof getPalette>

// Anime-style face with 5 expressions
export function Face({ expression, animT, palette, irisColor }: {
  expression: Expression; animT: number; palette: Palette; irisColor: string
}) {
  const blink = Math.sin(animT * 0.8) > 0.97

  return (
    <g>
      {blink ? (
        <>
          {/* Blink lines */}
          <line x1="-7" y1="19" x2="-1" y2="19" stroke={palette.outline} strokeWidth="1.5" strokeLinecap="round" />
          <line x1="1" y1="19" x2="7" y2="19" stroke={palette.outline} strokeWidth="1.5" strokeLinecap="round" />
        </>
      ) : expression === 'happy' ? (
        <>
          {/* Happy ^_^ eyes — curved arcs */}
          <path d="M-7,20 Q-4,16 -1,20" fill="none" stroke={palette.outline} strokeWidth="1.5" strokeLinecap="round" />
          <path d="M1,20 Q4,16 7,20" fill="none" stroke={palette.outline} strokeWidth="1.5" strokeLinecap="round" />
        </>
      ) : (
        <>
          {/* === Left anime eye === */}
          {/* Eye white */}
          <ellipse cx="-4" cy="19" rx={expression === 'focused' ? 4 : 4} ry={expression === 'focused' ? 2 : 4.5}
            fill="white" stroke={palette.outline} strokeWidth="1" />
          {/* Iris */}
          <circle cx={expression === 'thinking' ? '-2' : '-3.5'} cy="19" r="3"
            fill={irisColor} opacity="0.85" />
          {/* Pupil */}
          <circle cx={expression === 'thinking' ? '-2' : '-3.5'} cy="19" r="1.5" fill={palette.outline} />
          {/* Large highlight */}
          <circle cx={expression === 'thinking' ? '-1' : '-2.5'} cy="17.5" r="0.8" fill="white" />
          {/* Small highlight */}
          <circle cx={expression === 'thinking' ? '-3' : '-4.5'} cy="20.5" r="0.5" fill="white" />
          {/* Upper eyelid line */}
          <path d={`M-8,${expression === 'focused' ? '17.5' : '15'} Q-4,${expression === 'focused' ? '15.5' : '14.5'} 0,${expression === 'focused' ? '17.5' : '15'}`}
            fill="none" stroke={palette.outline} strokeWidth="1.5" strokeLinecap="round" />

          {/* === Right anime eye === */}
          <ellipse cx="4" cy="19" rx={expression === 'focused' ? 4 : 4} ry={expression === 'focused' ? 2 : 4.5}
            fill="white" stroke={palette.outline} strokeWidth="1" />
          <circle cx={expression === 'thinking' ? '6' : '4.5'} cy="19" r="3"
            fill={irisColor} opacity="0.85" />
          <circle cx={expression === 'thinking' ? '6' : '4.5'} cy="19" r="1.5" fill={palette.outline} />
          <circle cx={expression === 'thinking' ? '7' : '5.5'} cy="17.5" r="0.8" fill="white" />
          <circle cx={expression === 'thinking' ? '5' : '3.5'} cy="20.5" r="0.5" fill="white" />
          <path d={`M0,${expression === 'focused' ? '17.5' : '15'} Q4,${expression === 'focused' ? '15.5' : '14.5'} 8,${expression === 'focused' ? '17.5' : '15'}`}
            fill="none" stroke={palette.outline} strokeWidth="1.5" strokeLinecap="round" />
        </>
      )}

      {/* Focused eyebrows — furrowed */}
      {expression === 'focused' && !blink && (
        <>
          <path d="M-8,15 L-2,16.5" fill="none" stroke={palette.outline} strokeWidth="1.2" strokeLinecap="round" />
          <path d="M8,15 L2,16.5" fill="none" stroke={palette.outline} strokeWidth="1.2" strokeLinecap="round" />
        </>
      )}

      {/* Mouth */}
      {expression === 'happy' && (
        <path d="M-3,24 Q0,28 3,24" fill="none" stroke={palette.outline} strokeWidth="1" strokeLinecap="round" />
      )}
      {expression === 'worried' && (
        <path d="M-3,25 Q-1.5,23 0,25 Q1.5,27 3,25" fill="none" stroke={palette.outline} strokeWidth="1" strokeLinecap="round" />
      )}
      {expression === 'focused' && (
        <line x1="-2" y1="24" x2="2" y2="24" stroke={palette.outline} strokeWidth="1" />
      )}
      {expression === 'neutral' && (
        <line x1="-1.5" y1="24" x2="1.5" y2="24" stroke={palette.outline} strokeWidth="1" />
      )}
      {expression === 'thinking' && (
        <circle cx="1" cy="25" r="1.5" fill="none" stroke={palette.outline} strokeWidth="1" />
      )}

      {/* Cheek blush for happy */}
      {expression === 'happy' && (
        <>
          <circle cx="-9" cy="22" r="2.5" fill={palette.fabricFill} opacity="0.35" />
          <circle cx="9" cy="22" r="2.5" fill={palette.fabricFill} opacity="0.35" />
        </>
      )}
      {/* Sweat drop for worried */}
      {expression === 'worried' && (
        <ellipse cx="12" cy="14" rx="1.5" ry="2" fill={palette.screenGlow} opacity="0.6" />
      )}
      {/* Thinking dots above head */}
      {expression === 'thinking' && (
        <>
          <circle cx="-3" cy="1" r="1" fill={palette.outline} opacity="0.25" />
          <circle cx="0" cy="-1" r="1" fill={palette.outline} opacity="0.5" />
          <circle cx="3" cy="-3" r="1" fill={palette.outline} opacity="0.75" />
        </>
      )}
    </g>
  )
}
