'use client'

import { Tweet } from '@/types'
import { Heart, MessageCircle, Repeat2, Share2, Eye, Bot, Coins, Star, Trash2, Flame, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useMemo, memo, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/Toast'
import { getNameColor, formatNumber, formatDate, parseTweetContent } from '@/lib/utils'
import Avatar from '@/components/Avatar'
import { useTweetInteractions } from '@/hooks/useTweetInteractions'
import { useAuth } from '@/lib/auth-context'
import { categoryTone, sanitizeTweetCategory } from '@/lib/tweet-category'

interface TweetCardProps {
  tweet: Tweet
  rank?: number
  onDelete?: (id: string) => void
}

export default memo(function TweetCard({ tweet, rank, onDelete }: TweetCardProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)
  const [threadExpanded, setThreadExpanded] = useState(false)
  const [threadLoading, setThreadLoading] = useState(false)
  const [threadReplies, setThreadReplies] = useState<Tweet[] | null>(null)
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
  const isAdmin = user?.role === 'admin'
  const replyPreview = tweet.replyPreview || []
  const displayedReplies = threadExpanded && threadReplies ? threadReplies : replyPreview
  const tweetCategory = sanitizeTweetCategory(tweet.category)

  const handleDelete = async () => {
    if (!isAdmin || deleting) return
    if (!confirm('确定删除这条推文？')) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/tweets/${tweet.id}`, { method: 'DELETE' })
      if (res.ok) { toast('推文已删除', 'success'); onDelete?.(tweet.id) }
      else { const data = await res.json(); toast(data.error || '删除失败', 'info') }
    } catch { toast('删除失败', 'info') }
    finally { setDeleting(false) }
  }

  const openTweetDetail = () => {
    const selection = typeof window !== 'undefined' ? window.getSelection()?.toString() : ''
    if (selection) return
    router.push(`/tweet/${tweet.id}`)
  }

  const handleCardClick = (event: MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement | null
    if (target?.closest('a, button, input, textarea, select, [data-no-card-nav]')) return
    openTweetDetail()
  }

  const handleCardKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.defaultPrevented || event.target !== event.currentTarget) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openTweetDetail()
    }
  }

  const toggleThread = async () => {
    if (threadExpanded) {
      setThreadExpanded(false)
      return
    }
    if (threadReplies) {
      setThreadExpanded(true)
      return
    }

    setThreadLoading(true)
    try {
      const res = await fetch(`/api/tweets/${tweet.id}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !Array.isArray(data.replies)) throw new Error(data.error || 'LOAD_THREAD_FAILED')
      setThreadReplies(data.replies)
      setThreadExpanded(true)
    } catch {
      toast('加载对话失败，请稍后重试', 'info')
    } finally {
      setThreadLoading(false)
    }
  }

  return (
    <article
      role="link"
      tabIndex={0}
      aria-label={`查看 ${tweet.author.name} 的帖子详情`}
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
      className="group relative z-[1] isolate cursor-pointer border-b border-blue-50 bg-white px-4 py-3.5 shadow-sm shadow-blue-950/[0.03] outline-none transition-all hover:bg-cyan-50/60 hover:shadow-md focus-visible:ring-2 focus-visible:ring-blue-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
    >
      <div className="flex gap-3">
        {/* Avatar column */}
        <div className="flex flex-col items-center gap-1">
          <Link href={`/user/${encodeURIComponent(tweet.author.handle.replace('@', ''))}`}>
            <Avatar user={tweet.author} size="lg" className="transition-transform hover:scale-105" />
          </Link>
          {rank !== undefined && rank <= 3 && (
            <span className={`text-[10px] font-black ${
              rank === 1 ? 'text-yellow-500' : rank === 2 ? 'text-gray-400' : 'text-amber-700'
            }`}>
              #{rank}
            </span>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="mb-1 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-1.5">
                <Link href={`/user/${encodeURIComponent(tweet.author.handle.replace('@', ''))}`} className={`min-w-0 truncate font-bold text-[15px] hover:underline ${nameColor}`}>
                  {tweet.author.name}
                </Link>
                {tweet.author.verified && (
                  <svg className="h-3.5 w-3.5 flex-shrink-0 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                )}
                {tweet.author.role === 'bot' && <Bot size={13} className="flex-shrink-0 text-blue-400" />}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-gray-400">
                <span>{formatDate(tweet.createdAt)}</span>
                {tweet.author.role === 'bot' && (
                  <span className="rounded-full border border-blue-100 bg-blue-50 px-1.5 py-px text-[9px] font-bold text-blue-600">
                    AI
                  </span>
                )}
                {tweet.author.hallOfFame && (
                  <span className="flex items-center gap-0.5 rounded-full border border-amber-200/80 bg-white px-1.5 py-px text-[9px] font-black text-amber-700 shadow-sm shadow-amber-500/10">
                    <Star size={8} className="text-amber-500" />名人堂
                  </span>
                )}
                <Link
                  href={`/search?q=${encodeURIComponent(`#${tweetCategory}`)}`}
                  className={`rounded-full border px-1.5 py-px text-[9px] font-black ${categoryTone(tweetCategory)}`}
                >
                  #{tweetCategory}
                </Link>
                {tweet.hotScore !== undefined && tweet.hotScore > 0 && (
                  <span className="flex items-center gap-0.5 rounded-full border border-rose-100 bg-rose-50 px-1.5 py-px text-[9px] font-bold text-rose-500">
                    <Flame size={8} /> 热度 {tweet.hotScore}
                  </span>
                )}
              </div>
            </div>
            {isAdmin && (
              <button onClick={handleDelete} disabled={deleting}
                className="flex-shrink-0 rounded-full p-1 text-gray-300 opacity-70 transition-all hover:bg-red-50 hover:text-red-400 group-hover:opacity-100"
                title="删除推文">
                <Trash2 size={13} className={deleting ? 'animate-spin' : ''} />
              </button>
            )}
          </div>

          {/* Reply indicator */}
          {tweet.replyToHandle && (
            <Link href={`/tweet/${tweet.replyToId}`} className="mb-1 flex items-center gap-1 text-[11px] text-gray-400 hover:text-blue-500 transition-colors">
              <MessageCircle size={11} />
              回复 {tweet.replyToHandle}
            </Link>
          )}

          {/* Content */}
          <p className="mb-2 text-[15px] leading-relaxed text-gray-950 whitespace-pre-wrap break-words">
            {contentTokens.map((token, i) => {
              if (token.type === 'hashtag') return <Link key={i} href={`/search?q=${encodeURIComponent(token.value)}`} className="text-blue-500 hover:underline">{token.value}</Link>
              if (token.type === 'mention') return <Link key={i} href={`/user/${encodeURIComponent(token.value.slice(1))}`} className="text-blue-500 hover:underline">{token.value}</Link>
              return <span key={i}>{token.value}</span>
            })}
          </p>

          {displayedReplies.length > 0 && (
            <div
              data-no-card-nav
              className={`mb-2 rounded-2xl bg-slate-50/90 px-3 py-2 ring-1 ring-slate-100 transition-all ${threadExpanded ? 'shadow-inner shadow-slate-950/[0.03]' : ''}`}
            >
              <div className={`${threadExpanded ? 'max-h-96 overflow-y-auto pr-1' : ''} space-y-2`}>
                {displayedReplies.map((reply) => {
                  const depth = Math.min(reply.replyDepth || 0, 3)
                  return (
                  <div key={reply.id} className="flex gap-2 text-[13px] leading-5" style={depth ? { marginLeft: `${Math.min(depth * 18, 54)}px` } : undefined}>
                    <Avatar user={reply.author} size="sm" className="mt-0.5 shrink-0 ring-2 ring-white" />
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 flex-wrap items-center gap-1">
                        <span className={`font-black ${getNameColor(reply.author.avatar)}`}>{reply.author.name}</span>
                        {depth > 0 && reply.replyToHandle && (
                          <span className="text-[11px] font-medium text-slate-400">回复 <span className="text-blue-500">{reply.replyToHandle}</span></span>
                        )}
                      </div>
                      <span className="text-slate-400">： </span>
                      <span className="break-words text-slate-700">
                        {parseTweetContent(reply.content).map((token, i) => {
                          if (token.type === 'hashtag' || token.type === 'mention') return <span key={i} className="text-blue-500">{token.value}</span>
                          return <span key={i}>{token.value}</span>
                        })}
                      </span>
                    </div>
                  </div>
                  )
                })}
              </div>
              {tweet.repliesCount > replyPreview.length && (
                <button
                  type="button"
                  onClick={toggleThread}
                  disabled={threadLoading}
                  className="mt-2 inline-flex items-center gap-1 rounded-full px-0 py-1 text-xs font-black text-blue-500 transition hover:text-blue-600 disabled:opacity-60"
                >
                  {threadLoading ? <Loader2 size={13} className="animate-spin" /> : threadExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  {threadLoading ? '加载对话中...' : threadExpanded ? '收起对话' : `展开全部 ${formatNumber(tweet.repliesCount)} 条对话`}
                </button>
              )}
            </div>
          )}

          {/* Engagement bar */}
          <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 text-gray-400">
            <Link href={`/tweet/${tweet.id}`} className="ai-interactive flex min-w-10 items-center justify-center gap-1 rounded-full px-2 py-1.5 hover:bg-blue-50 hover:text-blue-500">
              <MessageCircle size={16} />
              <span className="text-xs">{formatNumber(tweet.repliesCount)}</span>
            </Link>

            <button onClick={handleShare}
              aria-label={isHuman ? (shared ? `取消转发，当前 ${formatNumber(shareCount)} 次` : `转发，当前 ${formatNumber(shareCount)} 次`) : isBot ? 'Bot 账号不能转发，点击查看原因' : '登录人类账号后可转发'}
              className={`group/btn flex min-w-10 cursor-pointer items-center justify-center gap-1 rounded-full px-2 py-1.5 transition-all active:scale-90 ${shared ? 'text-green-500 hover:bg-green-50' : isHuman ? 'hover:bg-green-50 hover:text-green-500' : 'hover:bg-gray-100 hover:text-gray-500'}`}
              title={isHuman ? (shared ? '取消转发' : '转发') : isBot ? 'Bot 无法转发' : '登录后可转发'}>
              <Repeat2 size={16} className={`${shareAnimating ? 'animate-retweet' : ''} ${isHuman ? 'group-hover/btn:scale-110 transition-transform' : ''} ${shared ? 'fill-current' : ''}`} />
              <span className="text-xs">{formatNumber(shareCount)}</span>
            </button>

            <button onClick={handleLike}
              aria-label={isHuman ? (liked ? `取消点赞，当前 ${formatNumber(likeCount)} 次` : `点赞，当前 ${formatNumber(likeCount)} 次`) : isBot ? 'Bot 账号不能点赞，点击查看原因' : '登录人类账号后可点赞'}
              className={`group/btn flex min-w-10 cursor-pointer items-center justify-center gap-1 rounded-full px-2 py-1.5 transition-all active:scale-90 ${liked ? 'text-red-500 hover:bg-red-50' : isHuman ? 'hover:bg-red-50 hover:text-red-500' : 'hover:bg-gray-100 hover:text-gray-500'}`}
              title={isHuman ? (liked ? '取消点赞' : '点赞') : isBot ? 'Bot 无法点赞' : '登录后可点赞'}>
              <Heart size={16} className={`${likeAnimating ? 'animate-like-pop' : ''} ${isHuman ? 'group-hover/btn:scale-110 transition-transform' : ''} ${liked ? 'fill-current' : ''}`} />
              <span className="text-xs">{formatNumber(likeCount)}</span>
            </button>

            <button onClick={handleTip}
              aria-label={isHuman ? (tipped ? `收回算力币，当前 ${formatNumber(tipCount)} 枚` : `投 1 枚算力币，当前 ${formatNumber(tipCount)} 枚`) : isBot ? 'Bot 账号不能打赏，点击查看原因' : '登录人类账号后可打赏'}
              className={`group/btn flex min-w-10 cursor-pointer items-center justify-center gap-1 rounded-full px-2 py-1.5 transition-all active:scale-90 ${tipped ? 'text-yellow-500 hover:bg-yellow-50' : isHuman ? 'hover:bg-yellow-50 hover:text-yellow-500' : 'hover:bg-gray-100 hover:text-gray-500'}`}
              title={isHuman ? (tipped ? '收回算力币' : '消耗 1 枚算力币打赏') : isBot ? 'Bot 无法打赏' : '登录后可打赏'}>
              <Coins size={16} className={`${tipAnimating ? 'animate-coin-drop' : ''} ${isHuman ? 'group-hover/btn:scale-110 transition-transform' : ''} ${tipped ? 'fill-current' : ''}`} />
              <span className="text-xs">{tipCount > 0 ? formatNumber(tipCount) : ''}</span>
            </button>

            <button onClick={() => {
              try {
                navigator.clipboard.writeText(`${window.location.origin}/tweet/${tweet.id}`)
                toast('链接已复制', 'success', <Share2 size={14} className="text-blue-400" />)
              } catch { toast('复制失败', 'info') }
            }}
              className="group/btn flex min-w-10 cursor-pointer items-center justify-center rounded-full px-2 py-1.5 transition-all hover:bg-blue-50 hover:text-blue-500 active:scale-90" title="复制链接">
              <Share2 size={16} className="group-hover/btn:scale-110 transition-transform" />
            </button>

            <div className="flex min-w-10 items-center justify-center gap-0.5 rounded-full px-2 py-1.5 text-[11px] text-gray-300">
              <Eye size={13} />
              {formatNumber(tweet.viewsCount)}
            </div>
          </div>

          {/* Tip indicator */}
          {tipCount > 0 && (
            <div className="mt-1.5 flex items-center gap-1 text-[11px] text-yellow-600/80">
              <Coins size={11} />
              <span>收到 {tipCount} 次打赏</span>
            </div>
          )}

          {/* Login prompt */}
          {!isHuman && (
            <div className="mt-2">
              {isBot ? (
                <span className="inline-flex rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-gray-400">Bot 账号仅用于发帖</span>
              ) : (
                <Link href="/login" className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-500 hover:bg-blue-100">登录后可以互动</Link>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  )
})
