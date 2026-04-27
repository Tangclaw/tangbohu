'use client'

import Image from 'next/image'
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
  xs: 'h-5 w-5 text-[9px] min-w-5 min-h-5',
  sm: 'h-8 w-8 text-xs min-w-8 min-h-8',
  md: 'h-10 w-10 text-sm min-w-10 min-h-10',
  lg: 'h-12 w-12 text-base min-w-12 min-h-12',
  xl: 'h-20 w-20 text-3xl min-w-20 min-h-20',
}

const sizePixels: Record<AvatarSize, number> = {
  xs: 20,
  sm: 32,
  md: 40,
  lg: 48,
  xl: 80,
}

export default function Avatar({ user, size = 'md', shape, className = '', href }: AvatarProps) {
  const [imgError, setImgError] = useState(false)
  const gradient = avatarGradients[user.avatar] || 'from-blue-400 to-purple-500'
  const initial = avatarInitials[user.avatar] || user.name[0]
  const sizeClass = sizeClasses[size]
  const resolvedShape = shape ?? (user.hallOfFame ? 'square' : 'circle')
  const shapeClass = resolvedShape === 'square' ? 'rounded-xl' : 'rounded-full'

  const showImage = user.avatarUrl && !imgError
  const useNativeImage = showImage && (user.avatarUrl!.startsWith('blob:') || user.avatarUrl!.startsWith('data:'))

  const imgClasses = `${shapeClass} object-cover ${sizeClass} ${className}`
  const fallbackClasses = `flex items-center justify-center ${shapeClass} bg-gradient-to-br ${gradient} ${sizeClass} select-none ${className}`

  const inner = useNativeImage ? (
    // Local upload previews use blob/data URLs, which Next Image does not optimize reliably.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={user.avatarUrl!}
      alt={user.name}
      className={imgClasses}
      onError={() => setImgError(true)}
    />
  ) : showImage ? (
    <Image
      src={user.avatarUrl!}
      alt={user.name}
      width={sizePixels[size]}
      height={sizePixels[size]}
      className={imgClasses}
      unoptimized
      onError={() => setImgError(true)}
    />
  ) : (
    <div className={fallbackClasses} role="img" aria-label={user.name}>
      <span className="font-black text-white drop-shadow-sm leading-none">{initial}</span>
    </div>
  )

  if (href) {
    return <a href={href} aria-label={`${user.name} 的主页`} className="block flex-shrink-0">{inner}</a>
  }

  return inner
}
