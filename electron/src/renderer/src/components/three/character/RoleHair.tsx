import type { TeamRole } from '../../../stores/app'
import { getPalette } from '../themeColors'

type Palette = ReturnType<typeof getPalette>

// Role-specific hair with richer detail and layering
export function RoleHair({ role, palette }: { role: TeamRole; palette: Palette }) {
  switch (role) {
    case 'boss':
      return (
        <g>
          {/* Slicked back short hair with part */}
          <path d="M-14,16 Q-16,6 -8,8 Q-4,3 0,6 Q4,3 8,8 Q16,6 14,16"
            fill="#1a1a2e" stroke={palette.outline} strokeWidth="1" />
          {/* Sideburn triangles */}
          <path d="M-14,16 L-15,20 L-12,17 Z" fill="#1a1a2e" stroke="none" />
          <path d="M14,16 L15,20 L12,17 Z" fill="#1a1a2e" stroke="none" />
          {/* Highlight strands */}
          <line x1="-6" y1="8" x2="-4" y2="13" stroke="white" strokeWidth="0.5" opacity="0.3" />
          <line x1="-1" y1="7" x2="0" y2="12" stroke="white" strokeWidth="0.5" opacity="0.3" />
          <line x1="5" y1="8" x2="4" y2="13" stroke="white" strokeWidth="0.5" opacity="0.3" />
          {/* Extra volume layer */}
          <path d="M-10,10 Q-6,5 0,7 Q6,5 10,10" fill="none" stroke="#2a2a4e" strokeWidth="1.5" opacity="0.3" />
        </g>
      )
    case 'pm':
      return (
        <g>
          {/* Neat short hair — fuller shape */}
          <path d="M-14,18 Q-15,8 -8,10 Q0,5 8,10 Q15,8 14,18" fill="#5b3a1a" stroke={palette.outline} strokeWidth="1" />
          {/* Sideburns */}
          <path d="M-14,18 L-14.5,21 L-12,18 Z" fill="#5b3a1a" stroke="none" />
          <path d="M14,18 L14.5,21 L12,18 Z" fill="#5b3a1a" stroke="none" />
          {/* Full glasses — two frames + bridge + temples */}
          <circle cx="-5" cy="19" r="4.5" fill="none" stroke={palette.metalMid} strokeWidth="1" />
          <circle cx="5" cy="19" r="4.5" fill="none" stroke={palette.metalMid} strokeWidth="1" />
          {/* Lens reflection arcs */}
          <path d="M-7.5,17 Q-7,16 -6,17" fill="none" stroke="white" strokeWidth="0.5" opacity="0.4" />
          <path d="M2.5,17 Q3,16 4,17" fill="none" stroke="white" strokeWidth="0.5" opacity="0.4" />
          {/* Bridge */}
          <path d="M-0.5,19 Q0,18 0.5,19" fill="none" stroke={palette.metalMid} strokeWidth="1" />
          {/* Temples */}
          <line x1="-9.5" y1="19" x2="-13" y2="20" stroke={palette.metalMid} strokeWidth="0.8" />
          <line x1="9.5" y1="19" x2="13" y2="20" stroke={palette.metalMid} strokeWidth="0.8" />
        </g>
      )
    case 'developer':
      return (
        <g>
          {/* Messy spiky hair — base shape */}
          <path d="M-14,17 Q-16,4 -8,12 Q-4,2 0,10 Q4,2 8,12 Q16,4 14,17"
            fill={palette.metalDark} stroke={palette.outline} strokeWidth="1" />
          {/* Extra messy spikes */}
          <path d="M-10,10 L-12,5 L-8,9" fill={palette.metalDark} stroke="none" />
          <path d="M2,8 L0,3 L4,7" fill={palette.metalDark} stroke="none" />
          <path d="M10,10 L12,5 L8,9" fill={palette.metalDark} stroke="none" />
          {/* Spike highlights */}
          <line x1="-11" y1="6" x2="-10" y2="8" stroke="white" strokeWidth="0.4" opacity="0.25" />
          <line x1="1" y1="4" x2="1.5" y2="6" stroke="white" strokeWidth="0.4" opacity="0.25" />
          <line x1="11" y1="6" x2="10" y2="8" stroke="white" strokeWidth="0.4" opacity="0.25" />
          {/* Headphone ear cups */}
          <circle cx="-14" cy="19" r="4" fill={palette.metalMid} stroke={palette.outline} strokeWidth="1" />
          <circle cx="14" cy="19" r="4" fill={palette.metalMid} stroke={palette.outline} strokeWidth="1" />
          {/* Headphone inner cushion */}
          <circle cx="-14" cy="19" r="2.5" fill={palette.metalDark} opacity="0.5" />
          <circle cx="14" cy="19" r="2.5" fill={palette.metalDark} opacity="0.5" />
          {/* Headphone headband arc */}
          <path d="M-14,16 Q-16,4 0,2 Q16,4 14,16" fill="none" stroke={palette.metalLight} strokeWidth="2" />
          {/* Headband stitching detail */}
          <path d="M-8,7 Q0,5 8,7" fill="none" stroke={palette.metalDark} strokeWidth="0.5" opacity="0.4" />
        </g>
      )
    case 'designer':
      return (
        <g>
          {/* Longer flowing hair with volume */}
          <path d="M-15,22 Q-16,6 0,4 Q16,6 15,22" fill="#f472b6" stroke={palette.outline} strokeWidth="1" />
          {/* Hair strand detail layers */}
          <path d="M-12,18 Q-10,8 -2,6 Q4,5 8,8 Q12,10 13,18" fill="#e879a8" stroke="none" opacity="0.4" />
          <path d="M-10,20 Q-8,10 0,8 Q8,10 10,20" fill="#f9a8d4" stroke="none" opacity="0.2" />
          {/* Flowing bangs */}
          <path d="M-10,14 Q-6,10 -2,12 Q2,9 6,12 Q9,10 11,14" fill="#f472b6" stroke={palette.outline} strokeWidth="0.5" />
          {/* Ponytail */}
          <path d="M12,18 Q16,24 14,30 Q12,34 10,32" fill="#f472b6" stroke={palette.outline} strokeWidth="0.8" />
          {/* Ponytail hairband */}
          <ellipse cx="12" cy="18" rx="2" ry="1.5" fill="#db2777" stroke={palette.outline} strokeWidth="0.4" />
          {/* Flowing hair strand animation hint */}
          <path d="M10,30 Q8,34 7,32" fill="none" stroke="#f9a8d4" strokeWidth="0.6" opacity="0.5" />
          {/* Beret */}
          <ellipse cx="-2" cy="7" rx="11" ry="5" fill="#ec4899" stroke={palette.outline} strokeWidth="1" />
          <circle cx="-2" cy="4" r="2" fill="#db2777" />
          {/* Beret ribbon bow */}
          <path d="M-6,9 Q-8,7 -6,6 Q-4,7 -6,9" fill="#db2777" stroke="none" />
          <path d="M-6,9 Q-4,7 -6,6 Q-8,7 -6,9" fill="#db2777" stroke="none" opacity="0.7" />
        </g>
      )
    case 'tester':
      return (
        <g>
          {/* Sporty short hair — base */}
          <path d="M-14,18 Q-14,8 0,6 Q14,8 14,18" fill="#92400e" stroke={palette.outline} strokeWidth="1" />
          {/* Bang layers — 3 overlapping paths */}
          <path d="M-10,12 Q-8,8 -4,10 Q-2,7 0,9" fill="#92400e" stroke={palette.outline} strokeWidth="0.5" opacity="0.8" />
          <path d="M-4,11 Q0,7 4,10 Q6,8 8,11" fill="#a0522d" stroke={palette.outline} strokeWidth="0.5" opacity="0.6" />
          <path d="M2,11 Q5,8 8,10 Q10,9 12,12" fill="#92400e" stroke={palette.outline} strokeWidth="0.5" opacity="0.7" />
          {/* Sport headband */}
          <path d="M-13,14 Q-13,12 0,11 Q13,12 13,14 L13,15 Q13,13 0,12 Q-13,13 -13,15 Z"
            fill={palette.fabricFill} opacity="0.8" />
          {/* Headband highlight */}
          <path d="M-11,13 Q0,11.5 11,13" fill="none" stroke="white" strokeWidth="0.4" opacity="0.3" />
          {/* Hair sticking out above headband */}
          <path d="M-8,11 Q-6,8 -4,10" fill="#92400e" stroke="none" />
          <path d="M2,10 Q4,7 6,9" fill="#92400e" stroke="none" />
        </g>
      )
    case 'worker':
      return (
        <g>
          {/* Standard short hair beneath hard hat */}
          <path d="M-13,18 Q-14,12 0,10 Q14,12 13,18" fill={palette.metalDark} stroke={palette.outline} strokeWidth="0.8" />
          {/* Sideburns */}
          <path d="M-13,18 L-13.5,20 L-12,18 Z" fill={palette.metalDark} stroke="none" />
          <path d="M13,18 L13.5,20 L12,18 Z" fill={palette.metalDark} stroke="none" />
          {/* Hard hat */}
          <path d="M-15,14 Q-17,2 0,0 Q17,2 15,14" fill="#fbbf24" stroke={palette.outline} strokeWidth="1.5" />
          {/* Hat brim */}
          <line x1="-13" y1="12" x2="13" y2="12" stroke="#f59e0b" strokeWidth="2" />
          {/* Brim highlight line */}
          <path d="M-11,11 Q0,9 11,11" fill="none" stroke="#fde68a" strokeWidth="0.8" opacity="0.5" />
          {/* Brim shadow line */}
          <line x1="-12" y1="14" x2="12" y2="14" stroke="#d97706" strokeWidth="1" opacity="0.4" />
          {/* Hat top highlight */}
          <path d="M-6,5 Q0,2 6,5" fill="none" stroke="#fde68a" strokeWidth="0.6" opacity="0.4" />
        </g>
      )
    default:
      return (
        <path d="M-14,18 Q-14,8 0,6 Q14,8 14,18" fill={palette.metalDark} stroke={palette.outline} strokeWidth="1" />
      )
  }
}
