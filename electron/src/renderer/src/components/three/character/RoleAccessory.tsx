import type { TeamRole } from '../../../stores/app'
import { getPalette } from '../themeColors'

type Palette = ReturnType<typeof getPalette>

// Role accessory held in right hand
export function RoleAccessory({ role, palette }: { role: TeamRole; palette: Palette }) {
  switch (role) {
    case 'boss':
      return (
        <g transform="translate(0,16)">
          {/* Thermos / insulated cup */}
          <rect x="-2" y="-6" width="4" height="9" rx="1.5" fill={palette.metalMid} stroke={palette.outline} strokeWidth="0.5" />
          <line x1="-2.5" y1="-6" x2="2.5" y2="-6" stroke={palette.metalDark} strokeWidth="1" />
          <rect x="-2.5" y="-8" width="5" height="2" rx="0.8" fill={palette.metalLight} stroke={palette.outline} strokeWidth="0.4" />
        </g>
      )
    case 'pm':
      return (
        <g transform="translate(0,16)">
          {/* Tablet */}
          <rect x="-4" y="-8" width="8" height="11" rx="1" fill={palette.metalDark} stroke={palette.outline} strokeWidth="0.5" />
          <line x1="-2.5" y1="-5" x2="2.5" y2="-5" stroke={palette.screenGlow} strokeWidth="0.4" opacity="0.5" />
          <line x1="-2.5" y1="-3" x2="1.5" y2="-3" stroke={palette.screenGlow} strokeWidth="0.4" opacity="0.5" />
          <line x1="-2.5" y1="-1" x2="2" y2="-1" stroke={palette.screenGlow} strokeWidth="0.4" opacity="0.5" />
        </g>
      )
    case 'developer':
      return (
        <g transform="translate(0,16)">
          {/* Mechanical keyboard */}
          <rect x="-5" y="-4" width="10" height="7" rx="1" fill={palette.metalDark} stroke={palette.outline} strokeWidth="0.5" />
          <rect x="-4" y="-3" width="2" height="2" rx="0.3" fill={palette.metalMid} />
          <rect x="-1.5" y="-3" width="2" height="2" rx="0.3" fill={palette.metalMid} />
          <rect x="1" y="-3" width="2" height="2" rx="0.3" fill={palette.metalMid} />
          <rect x="-4" y="-0.5" width="2" height="2" rx="0.3" fill={palette.metalMid} />
          <rect x="-1.5" y="-0.5" width="2" height="2" rx="0.3" fill={palette.metalMid} />
          <rect x="1" y="-0.5" width="2" height="2" rx="0.3" fill={palette.metalMid} />
        </g>
      )
    case 'designer':
      return (
        <g transform="translate(0,16)">
          {/* Paintbrush */}
          <rect x="-0.5" y="-10" width="1" height="12" rx="0.3" fill={palette.metalMid} stroke={palette.outline} strokeWidth="0.3" />
          <polygon points="-1.5,-10 1.5,-10 0,-13" fill="#f472b6" stroke={palette.outline} strokeWidth="0.3" />
        </g>
      )
    case 'tester':
      return (
        <g transform="translate(0,16)">
          {/* Magnifying glass */}
          <circle cx="0" cy="-4" r="4" fill="none" stroke={palette.metalMid} strokeWidth="1" />
          <line x1="3" y1="-1" x2="6" y2="4" stroke={palette.metalMid} strokeWidth="1.5" />
          <path d="M-2,-6 Q-1,-7 0,-6" fill="none" stroke="white" strokeWidth="0.6" opacity="0.6" />
        </g>
      )
    case 'worker':
      return (
        <g transform="translate(0,16)">
          {/* Folder */}
          <rect x="-4" y="-5" width="8" height="10" rx="0.5" fill="#fbbf24" stroke={palette.outline} strokeWidth="0.5" />
          <rect x="-4" y="-7" width="4" height="2" rx="0.3" fill="#f59e0b" stroke={palette.outline} strokeWidth="0.3" />
          <line x1="-3" y1="-6.5" x2="-1" y2="-6.5" stroke="white" strokeWidth="0.4" />
          <line x1="-3" y1="-5.8" x2="-0.5" y2="-5.8" stroke="white" strokeWidth="0.4" />
        </g>
      )
    default:
      return null
  }
}
