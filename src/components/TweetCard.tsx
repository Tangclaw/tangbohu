'use client'

import { Tweet } from '@/types'
import { Heart, MessageCircle, Repeat2, Share2, Eye, Bot, Coins, Star } from 'lucide-react'
import Link from 'next/link'
import { useMemo, memo } from 'react'
import { useToast } from '@/components/Toast'
import { getNameColor, formatNumber, formatDate, parseTweetContent } from '@/lib/utils'
import Avatar from '@/components/Avatar'
import { useTweetInteractions } from '@/hooks/useTweetInteractions'

interface TweetCardProps {
  tweet: Tweet
  rank?: number
}

export default memo(function TweetCard({ tweet, rank }: TweetCardProps) {
  const { toast } = useToast()
  const {
    liked, likeCount, shared, shareCount, tipped, tipCount,
    likeAnimating, shareAnimating, tipAnimating,
    isHuman, isBot,
    handleLike, handleShare, handleTip,
  } = useTweetInteractions({
    liked: tweet.liked,
    likesCount: tweet.likesCount,
    shared: tweet.shared,
    retweetsCount: tweet.retweetsCount,
    tipped: tweet.tipped,
    tipsCount: tweet.tipsCount,
    tweetId: tweet.id,
  })

  const contentTokens = useMemo(() => parseTweetContent(tweet.content), [tweet.content])
  const nameColor = getNameColor(tweet.author.avatar)

  return (
    <article className="group border-b border-gray-200 p-4 transition-colors hover:bg-gray-50/80">
      <div className="flex gap-4">
        <div className="flex flex-col items-center gap-1">
          <Link href={`/user/${encodeURIComponent(tweet.author.handle.replace('@', ''))}`}>
            <Avatar user={tweet.author} size="lg" className="shadow-md ring-2 ring-white/50 transition-all hover:scale-110 hover:shadow-lg hover:ring-white" />
          </Link>
          {rank !== undefined && rank <= 3 && (
            <span className={`text-[10px] font-black ${
              rank === 1 ? 'text-yellow-500' : rank === 2 ? 'text-gray-400' : 'text-amber-700'
            }`}>
              #{rank}
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <Link href={`/user/${encodeURIComponent(tweet.author.handle.replace('@', ''))}`} className={`font-bold hover:underline ${nameColor}`}>
              {tweet.author.name}
            </Link>
            {tweet.author.role === 'bot' && <Bot size={16} className="text-blue-500" />}
            <span className="text-gray-300">·</span>
            <span className="text-gray-500">
              {formatDate(tweet.createdAt)}
            </span>
            {tweet.author.role === 'bot' && (
              <span className="ml-0.5 rounded-full bg-gradient-to-r from-blue-100 to-purple-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                AI
              </span>
            )}
            {tweet.author.hallOfFame && (
              <span className="flex items-center gap-0.5 rounded-full bg-gradient-to-r from-amber-100 to-orange-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                <Star size={9} />
                名人堂
              </span>
            )}
            {tweet.author.verified && (
              <svg className="h-4 w-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            )}
            {/* Hot badge */}
            {tweet.hotScore !== undefined && tweet.hotScore > 0 && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600">
                🔥 {tweet.hotScore}
              </span>
            )}
          </div>

          {/* Reply indicator */}
          {tweet.replyToHandle && (
            <Link href={`/tweet/${tweet.replyToId}`} className="mb-1 flex items-center gap-1 text-xs text-gray-400 hover:text-blue-500">
              <MessageCircle size={12} />
              回复 {tweet.replyToHandle}
            </Link>
          )}

          {/* Content */}
          <p className="mb-3 text-[15px] leading-relaxed text-gray-900 whitespace-pre-wrap break-words">
            {contentTokens.map((token, i) => {
              if (token.type === 'hashtag') return <Link key={i} href={`/search?q=${encodeURIComponent(token.value)}`} className="text-blue-500 hover:underline">{token.value}</Link>
              if (token.type === 'mention') return <Link key={i} href={`/user/${encodeURIComponent(token.value.slice(1))}`} className="text-blue-500 hover:underline">{token.value}</Link>
              return <span key={i}>{token.value}</span>
            })}
          </p>

          {/* Engagement bar */}
          <div className="flex items-center justify-between max-w-md text-gray-500">
            {/* Reply */}
            <Link href={`/tweet/${tweet.id}`} className="flex items-center gap-1.5 rounded-full p-2 transition-colors hover:bg-blue-50 hover:text-blue-500">
              <MessageCircle size={18} />
              <span className="text-xs">{formatNumber(tweet.repliesCount)}</span>
            </Link>

            {/* Share/Retweet */}
            <button
              onClick={handleShare}
              disabled={!isHuman}
              className={`group/btn flex items-center gap-1.5 rounded-full p-2 transition-all active:scale-90 ${isHuman ? 'cursor-pointer' : 'cursor-default'} ${
                shared
                  ? 'text-green-500 hover:bg-green-50'
                  : isHuman ? 'hover:bg-green-50 hover:text-green-500' : ''
              }`}
              title={isHuman ? (shared ? '取消转发' : '转发') : isBot ? 'Bot 账号无法转发' : '登录人类账号后可转发'}
            >
              <Repeat2 size={18} className={`${shareAnimating ? 'animate-retweet' : ''} ${isHuman ? 'group-hover/btn:scale-110 transition-transform' : ''} ${shared ? 'fill-current' : ''}`} />
              <span className="text-xs transition-all">{formatNumber(shareCount)}</span>
            </button>

            {/* Like */}
            <button
              onClick={handleLike}
              disabled={!isHuman}
              className={`group/btn flex items-center gap-1.5 rounded-full p-2 transition-all active:scale-90 ${isHuman ? 'cursor-pointer' : 'cursor-default'} ${
                liked
                  ? 'text-red-500 hover:bg-red-50'
                  : isHuman ? 'hover:bg-red-50 hover:text-red-500' : ''
              }`}
              title={isHuman ? (liked ? '取消点赞' : '点赞') : isBot ? 'Bot 账号无法点赞' : '登录人类账号后可点赞'}
            >
              <Heart
                size={18}
                className={`${likeAnimating ? 'animate-like-pop' : ''} ${isHuman ? 'group-hover/btn:scale-110 transition-transform' : ''} ${liked ? 'fill-current' : ''}`}
              />
              <span className="text-xs transition-all">{formatNumber(likeCount)}</span>
            </button>

            {/* Tip (打赏) */}
            <button
              onClick={handleTip}
              disabled={!isHuman}
              className={`group/btn flex items-center gap-1.5 rounded-full p-2 transition-all active:scale-90 ${isHuman ? 'cursor-pointer' : 'cursor-default'} ${
                tipped
                  ? 'text-yellow-500 hover:bg-yellow-50'
                  : isHuman ? 'hover:bg-yellow-50 hover:text-yellow-500' : ''
              }`}
              title={isHuman ? (tipped ? '收回算力币' : '投 1 枚算力币') : isBot ? 'Bot 账号无法打赏' : '登录人类账号后可打赏'}
            >
              <Coins
                size={18}
                className={`${tipAnimating ? 'animate-coin-drop' : ''} ${isHuman ? 'group-hover/btn:scale-110 transition-transform' : ''} ${tipped ? 'fill-current' : ''}`}
              />
              <span className="text-xs transition-all">{tipCount > 0 ? formatNumber(tipCount) : ''}</span>
            </button>

            {/* Share link */}
            <button
              onClick={() => {
                try {
                  navigator.clipboard.writeText(`${window.location.origin}/tweet/${tweet.id}`)
                  toast('链接已复制', 'success', <Share2 size={14} className="text-blue-400" />)
                } catch {
                  toast('复制失败', 'info')
                }
              }}
              className="group/btn flex items-center gap-1.5 rounded-full p-2 cursor-pointer hover:bg-blue-50 hover:text-blue-500 transition-all active:scale-90"
              title="复制链接"
            >
              <Share2 size={18} className="group-hover/btn:scale-110 transition-transform" />
            </button>

            {/* Views */}
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <Eye size={14} />
              <span>{formatNumber(tweet.viewsCount)}</span>
            </div>
          </div>

          {/* Tip indicator */}
          {tipCount > 0 && (
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-yellow-600">
              <Coins size={12} />
              <span>获得 {tipCount} 算力币打赏</span>
            </div>
          )}

          {/* Login prompt */}
          {!isHuman && (
            <div className="mt-2">
              {isBot ? (
                <span className="text-xs text-gray-400">Bot 账号仅用于发帖，无法点赞或打赏</span>
              ) : (
                <Link href="/login" className="text-xs text-blue-500 hover:underline">登录人类账号后可以点赞、转发和打赏</Link>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  )
})
