import type { TeamRole } from '../../../stores/app'
import { getPalette } from '../themeColors'

type Palette = ReturnType<typeof getPalette>

// Role outfit details on body
export function RoleOutfit({ role, color, palette }: { role: TeamRole; color: string; palette: Palette }) {
  switch (role) {
    case 'boss':
      return (
        <g>
          {/* Suit lapel V */}
          <line x1="-6" y1="35" x2="-1" y2="42" stroke="white" strokeWidth="0.8" />
          <line x1="6" y1="35" x2="1" y2="42" stroke="white" strokeWidth="0.8" />
          {/* Tie */}
          <polygon points="0,38 -2,44 0,50 2,44" fill="#dc2626" stroke={palette.outline} strokeWidth="0.5" />
          {/* Buttons */}
          <circle cx="0" cy="45" r="0.8" fill={palette.outline} />
          <circle cx="0" cy="48" r="0.8" fill={palette.outline} />
        </g>
      )
    case 'pm':
      return (
        <g>
          {/* Shirt collar */}
          <line x1="-4" y1="35" x2="0" y2="37" stroke="white" strokeWidth="0.8" />
          <line x1="4" y1="35" x2="0" y2="37" stroke="white" strokeWidth="0.8" />
          {/* Dark vest overlay */}
          <rect x="-7" y="36" width="14" height="10" rx="1" fill={palette.outline} opacity="0.3" />
        </g>
      )
    case 'developer':
      return (
        <g>
          {/* Hoodie strings */}
          <line x1="-2" y1="35" x2="-3" y2="40" stroke="white" strokeWidth="0.5" />
          <line x1="2" y1="35" x2="3" y2="40" stroke="white" strokeWidth="0.5" />
          {/* Kangaroo pocket */}
          <path d="M-5,43 Q-5,41 -3,41 L3,41 Q5,41 5,43 L5,47 Q5,49 3,49 L-3,49 Q-5,49 -5,47 Z"
            fill="none" stroke={palette.outline} strokeWidth="0.6" opacity="0.4" />
        </g>
      )
    case 'designer':
      return (
        <g>
          {/* Scarf around neck */}
          <path d="M-6,34 Q-4,36 0,35 Q4,36 6,34 Q6,38 4,39 Q0,37 -4,39 Q-6,38 -6,34"
            fill={color} stroke={palette.outline} strokeWidth="0.5" opacity="0.8" />
          {/* Paint stain on shoulder */}
          <rect x="-7" y="37" width="2.5" height="2.5" rx="0.5" fill={palette.fabricFill} opacity="0.6" />
          <rect x="5" y="39" width="2" height="2" rx="0.5" fill={palette.screenGlow} opacity="0.5" />
        </g>
      )
    case 'tester':
      return (
        <g>
          {/* Athletic jacket side stripes */}
          <line x1="-7" y1="35" x2="-7" y2="51" stroke="white" strokeWidth="1" opacity="0.5" />
          <line x1="7" y1="35" x2="7" y2="51" stroke="white" strokeWidth="1" opacity="0.5" />
        </g>
      )
    case 'worker':
      return (
        <g>
          {/* Shirt buttons down center */}
          <circle cx="0" cy="39" r="0.6" fill={palette.outline} />
          <circle cx="0" cy="43" r="0.6" fill={palette.outline} />
          <circle cx="0" cy="47" r="0.6" fill={palette.outline} />
          {/* Name badge */}
          <rect x="2" y="40" width="4" height="5" rx="0.5" fill="white" stroke={palette.outline} strokeWidth="0.4" />
          <text x="4" y="43.5" textAnchor="middle" fontSize="2.5" fontFamily="system-ui" fontWeight="700"
            fill={palette.outline}>W</text>
        </g>
      )
    default:
      return null
  }
}
