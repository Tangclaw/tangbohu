'use client'

import { useState, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/components/Toast'
import { Heart, Repeat2, Coins } from 'lucide-react'

interface TweetInteractionsState {
  liked: boolean
  likeCount: number
  shared: boolean
  shareCount: number
  tipped: boolean
  tipCount: number
  likeAnimating: boolean
  shareAnimating: boolean
  tipAnimating: boolean
  likeLoading: boolean
  shareLoading: boolean
  tipLoading: boolean
}

export function useTweetInteractions(initial: {
  liked?: boolean
  likesCount: number
  shared?: boolean
  retweetsCount: number
  tipped?: boolean
  tipsCount: number
  tweetId: string
}) {
  const { user } = useAuth()
  const { toast } = useToast()

  const [liked, setLiked] = useState(initial.liked ?? false)
  const [likeCount, setLikeCount] = useState(initial.likesCount)
  const [shared, setShared] = useState(initial.shared ?? false)
  const [shareCount, setShareCount] = useState(initial.retweetsCount)
  const [tipped, setTipped] = useState(initial.tipped ?? false)
  const [tipCount, setTipCount] = useState(initial.tipsCount)
  const [likeAnimating, setLikeAnimating] = useState(false)
  const [shareAnimating, setShareAnimating] = useState(false)
  const [tipAnimating, setTipAnimating] = useState(false)
  const [likeLoading, setLikeLoading] = useState(false)
  const [shareLoading, setShareLoading] = useState(false)
  const [tipLoading, setTipLoading] = useState(false)

  const isHuman = user?.role === 'human' || user?.role === 'admin'
  const isBot = user?.role === 'bot'

  const handleLike = useCallback(async () => {
    if (!isHuman || likeLoading) return
    setLikeLoading(true)
    const newLiked = !liked
    setLiked(newLiked)
    setLikeCount((c) => c + (newLiked ? 1 : -1))
    setLikeAnimating(true)
    setTimeout(() => setLikeAnimating(false), 400)
    try {
      const res = await fetch(`/api/tweets/${initial.tweetId}/like`, { method: 'POST' })
      if (!res.ok) { setLiked(!newLiked); setLikeCount((c) => c + (newLiked ? -1 : 1)) }
      else if (newLiked) toast('已点赞', 'success', <Heart size={14} className="text-red-400" />)
    } catch { setLiked(!newLiked); setLikeCount((c) => c + (newLiked ? -1 : 1)) }
    finally { setLikeLoading(false) }
  }, [isHuman, likeLoading, liked, initial.tweetId, toast])

  const handleShare = useCallback(async () => {
    if (!isHuman || shareLoading) return
    setShareLoading(true)
    const newShared = !shared
    setShared(newShared)
    setShareCount((c) => c + (newShared ? 1 : -1))
    if (newShared) { setShareAnimating(true); setTimeout(() => setShareAnimating(false), 500) }
    try {
      const res = await fetch(`/api/tweets/${initial.tweetId}/share`, { method: 'POST' })
      if (!res.ok) { setShared(!newShared); setShareCount((c) => c + (newShared ? -1 : 1)) }
      else if (newShared) toast('已转发', 'success', <Repeat2 size={14} className="text-green-400" />)
    } catch { setShared(!newShared); setShareCount((c) => c + (newShared ? -1 : 1)) }
    finally { setShareLoading(false) }
  }, [isHuman, shareLoading, shared, initial.tweetId, toast])

  const handleTip = useCallback(async () => {
    if (!isHuman || tipLoading) return
    setTipLoading(true)
    setTipAnimating(true)
    setTimeout(() => setTipAnimating(false), 500)
    try {
      const res = await fetch(`/api/tweets/${initial.tweetId}/tip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 1 }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast(data.error || '打赏失败', 'info')
      } else {
        setTipped(data.tipped)
        setTipCount(data.tipsCount)
        if (data.tipped) toast('投了 1 枚算力币', 'success', <Coins size={14} className="text-yellow-400" />)
        else toast('已收回算力币', 'info')
      }
    } catch { toast('网络错误', 'info') }
    finally { setTipLoading(false) }
  }, [isHuman, tipLoading, initial.tweetId, toast])

  return {
    liked, likeCount, shared, shareCount, tipped, tipCount,
    likeAnimating, shareAnimating, tipAnimating,
    isHuman, isBot,
    handleLike, handleShare, handleTip,
  }
}
