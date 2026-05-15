import { useState } from 'react'
import type { TeamRole } from '../../stores/app'
import type { AgentActivity } from './types'
import { ACTIVITY_COLORS } from './constants'
import { usePalette } from './PaletteContext'
import { getBounce, getLimbAngles, getExpression, getIrisColor } from './IsoCharacterAnimation'
import { Face, RoleHair, RoleOutfit, RoleAccessory } from './IsoCharacterParts'
import { useAnimTimeRef } from './AnimationContext'

interface Props {
  name: string
  role: TeamRole
  color: string
  activity: AgentActivity
  facing: 'left' | 'right'
  isWalking: boolean
  onClick?: () => void
}

export function IsoCharacter({ name, role, color, activity, facing, isWalking: _isWalking, onClick }: Props) {
  const animTimeRef = useAnimTimeRef()
  const animT = animTimeRef.current
  const flip = facing === 'left' ? -1 : 1
  const bounceY = getBounce(activity, animT)
  const { leftArm, rightArm, leftLeg, rightLeg } = getLimbAngles(activity, animT)
  const expression = getExpression(activity)
  const actColor = ACTIVITY_COLORS[activity] || color
  const [hovered, setHovered] = useState(false)
  const { palette, theme } = usePalette()
  const nameFill = theme === 'light' ? '#18181b' : '#e4e4e7'
  const nameStroke = theme === 'light' ? '#ffffff' : '#000000'
  const irisColor = getIrisColor(role, color)

  return (
    <g
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        cursor: 'pointer',
        transition: 'transform 0.15s ease',
        transform: hovered ? `scale(${flip * 1.08}, 1.08)` : `scale(${flip}, 1)`,
        transformOrigin: 'center center',
      }}
    >
      {/* Ground shadow */}
      <ellipse cx="0" cy="74" rx="16" ry="6" fill={`rgba(0,0,0,${palette.shadowOpacity})`} />

      <g transform={`translate(0,${bounceY})`}>
        {/* Left leg */}
        <g transform={`translate(-4,50) rotate(${leftLeg})`}>
          <rect x="-3" y="0" width="6" height="12" rx="2" fill={palette.metalDark} stroke={palette.outline} strokeWidth="1" />
          {/* Left shoe */}
          <rect x="-3.5" y="10" width="7" height="4" rx="2" fill={palette.metalMid} stroke={palette.outline} strokeWidth="0.8" />
        </g>
        {/* Right leg */}
        <g transform={`translate(4,50) rotate(${rightLeg})`}>
          <rect x="-3" y="0" width="6" height="12" rx="2" fill={palette.metalDark} stroke={palette.outline} strokeWidth="1" />
          {/* Right shoe — slightly darker */}
          <rect x="-3.5" y="10" width="7" height="4" rx="2" fill={palette.metalDark} stroke={palette.outline} strokeWidth="0.8" />
        </g>

        {/* Body */}
        <rect x="-8" y="34" width="16" height="18" rx="4"
          fill={color} stroke={palette.outline} strokeWidth="1.5" />
        {/* Inner edge highlight */}
        <rect x="-7" y="35" width="14" height="16" rx="3"
          fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="0.5" />
        {/* Role outfit detail */}
        <RoleOutfit role={role} color={color} palette={palette} />

        {/* Left arm */}
        <g transform={`translate(-10,38) rotate(${leftArm})`}>
          <rect x="-2.5" y="0" width="5" height="14" rx="2.5" fill={color} stroke={palette.outline} strokeWidth="1" />
          {/* Arm inner highlight */}
          <rect x="-1.5" y="1" width="3" height="12" rx="1.5"
            fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="0.4" />
          <circle cx="0" cy="15" r="3" fill={palette.skin} stroke={palette.skinShadow} strokeWidth="0.5" />
        </g>
        {/* Right arm */}
        <g transform={`translate(10,38) rotate(${rightArm})`}>
          <rect x="-2.5" y="0" width="5" height="14" rx="2.5" fill={color} stroke={palette.outline} strokeWidth="1" />
          <rect x="-1.5" y="1" width="3" height="12" rx="1.5"
            fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="0.4" />
          <circle cx="0" cy="15" r="3" fill={palette.skin} stroke={palette.skinShadow} strokeWidth="0.5" />
          <RoleAccessory role={role} palette={palette} />
        </g>

        {/* Ears — rendered before hair so hair overlaps */}
        <ellipse cx="-13" cy="22" rx="3" ry="4" fill={palette.skin} stroke={palette.skinShadow} strokeWidth="0.5" />
        <ellipse cx="13" cy="22" rx="3" ry="4" fill={palette.skin} stroke={palette.skinShadow} strokeWidth="0.5" />
        {/* Inner ear detail */}
        <ellipse cx="-13" cy="22" rx="1.5" ry="2.5" fill={palette.skinShadow} opacity="0.3" />
        <ellipse cx="13" cy="22" rx="1.5" ry="2.5" fill={palette.skinShadow} opacity="0.3" />

        {/* Head */}
        <circle cx="0" cy="20" r="16" fill={palette.skin} stroke={palette.outline} strokeWidth="1.5" />
        {/* Head inner highlight */}
        <circle cx="0" cy="20" r="15" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
        {/* Hair */}
        <RoleHair role={role} palette={palette} />
        {/* Face */}
        <Face expression={expression} animT={animT} palette={palette} irisColor={irisColor} />

        {/* Activity indicator ring */}
        <ellipse cx="0" cy="74" rx="12" ry="4"
          fill="none" stroke={actColor} strokeWidth="1.5" opacity={0.5} />
      </g>

      {/* Name label */}
      <text x="0" y="-4" textAnchor="middle" fontSize="7" fontFamily="system-ui" fontWeight="600"
        fill={nameFill} stroke={nameStroke} strokeWidth="2" paintOrder="stroke">
        {name}
      </text>
    </g>
  )
}
