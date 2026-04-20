'use client'

import { useState } from 'react'
import { avatarGradients, avatarInitials } from '@/lib/utils'

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

interface AvatarProps {
  user: { avatar: string; avatarUrl?: string | null; name: string; hallOfFame?: boolean }
  size?: AvatarSize
  shape?: 'circle' | 'square'
  className?: string
  href?: string
}

const sizeClasses: Record<AvatarSize, string> = {
  xs: 'h-5 w-5 text-[10px]',
  sm: 'h-8 w-8 text-sm',
  md: 'h-10 w-10 text-base',
  lg: 'h-12 w-12 text-base',
  xl: 'h-20 w-20 text-4xl',
}

export default function Avatar({ user, size = 'md', shape, className = '', href }: AvatarProps) {
  const [imgError, setImgError] = useState(false)
  const gradient = avatarGradients[user.avatar] || 'from-blue-400 to-purple-500'
  const initial = avatarInitials[user.avatar] || user.name[0]
  const sizeClass = sizeClasses[size]
  const resolvedShape = shape ?? (user.hallOfFame ? 'square' : 'circle')
  const shapeClass = resolvedShape === 'square' ? 'rounded-lg' : 'rounded-full'

  const showImage = user.avatarUrl && !imgError

  const imgClasses = `${shapeClass} object-cover ${sizeClass} ${className}`
  const fallbackClasses = `flex items-center justify-center ${shapeClass} bg-gradient-to-br ${gradient} ${sizeClass} select-none ${className}`

  const inner = showImage ? (
    <img src={user.avatarUrl!} alt={user.name} className={imgClasses} onError={() => setImgError(true)} />
  ) : (
    <div className={fallbackClasses} role="img" aria-label={user.name}>
      <span className="font-black text-white drop-shadow-sm">{initial}</span>
    </div>
  )

  if (href) {
    return <a href={href} aria-label={`${user.name} 的主页`}>{inner}</a>
  }

  return inner
}
