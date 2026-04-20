'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import Sidebar from '@/components/Sidebar'
import MobileNav from '@/components/MobileNav'
import { Tweet } from '@/types'
import { getNameColor, formatNumber, parseTweetContent } from '@/lib/utils'
import { ArrowLeft, Heart, Repeat2, Coins, Share2, Eye, MessageCircle, Bot, Star } from 'lucide-react'
import { useToast } from '@/components/Toast'
import Avatar from '@/components/Avatar'
import { useTweetInteractions } from '@/hooks/useTweetInteractions'

export default function TweetDetailPage() {
  const params = useParams()
  const tweetId = params.id as string
  const { toast } = useToast()
  const [tweet, setTweet] = useState<Tweet | null>(null)
  const [replies, setReplies] = useState<Tweet[]>([])
  const [replyTo, setReplyTo] = useState<Tweet | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    const fetchTweet = async () => {
      try {
        const res = await fetch(`/api/tweets/${tweetId}`)
        if (!res.ok) {
          if (res.status === 404) setNotFound(true)
          return
        }
        const data = await res.json()
        setTweet(data.tweet)
        setReplies(data.replies || [])
        setReplyTo(data.replyTo || null)
      } catch (error) {
        console.error('Failed to fetch tweet:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchTweet()
  }, [tweetId])

  const interactions = useTweetInteractions({
    liked: tweet?.liked,
    likesCount: tweet?.likesCount ?? 0,
    shared: tweet?.shared,
    retweetsCount: tweet?.retweetsCount ?? 0,
    tipped: tweet?.tipped,
    tipsCount: tweet?.tipsCount ?? 0,
    tweetId,
  })

  const contentTokens = useMemo(() => tweet ? parseTweetContent(tweet.content) : [], [tweet])

  if (notFound) {
    return (
      <div className="min-h-screen bg-white">
        <Navbar />
        <main className="ml-0 pb-16 lg:ml-20 lg:mr-80 xl:ml-64 lg:pb-0">
          <div className="flex min-h-[60vh] items-center justify-center">
            <div className="text-center">
              <p className="text-6xl mb-4">🔍</p>
              <p className="text-lg font-bold text-gray-900">推文不存在</p>
              <Link href="/" className="mt-4 inline-block text-sm text-blue-500 hover:underline">返回首页</Link>
            </div>
          </div>
        </main>
        <Sidebar />
        <MobileNav />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      <main className="ml-0 pb-16 lg:ml-20 lg:mr-80 xl:ml-64 lg:pb-0">
        {/* Header */}
        <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/80 backdrop-blur-md">
          <div className="flex items-center gap-3 px-4 py-3">
            <Link href="/" title="返回" className="rounded-full p-2 hover:bg-gray-100 transition-colors">
              <ArrowLeft size={20} className="text-gray-600" />
            </Link>
            <h1 className="text-lg font-bold text-gray-900">推文</h1>
          </div>
        </header>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-500" />
          </div>
        ) : tweet ? (
          <>
            {/* Tweet Detail */}
            <div className="p-4">
              {/* Author */}
              <div className="mb-3 flex items-center gap-3">
                <Link href={`/user/${encodeURIComponent(tweet.author.handle.replace('@', ''))}`}>
                  <Avatar user={tweet.author} size="lg" className="shadow-md hover:scale-110 hover:shadow-lg transition-all ring-2 ring-white/50" />
                </Link>
                <Link href={`/user/${encodeURIComponent(tweet.author.handle.replace('@', ''))}`} className="hover:underline">
                  <div className="flex items-center gap-1.5">
                    <span className={`font-bold ${getNameColor(tweet.author.avatar)}`}>{tweet.author.name}</span>
                    {tweet.author.verified && (
                      <svg className="h-4 w-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    )}
                    {tweet.author.role === 'bot' && (
                      <span className="rounded-full bg-gradient-to-r from-blue-100 to-purple-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">AI</span>
                    )}
                  </div>
                </Link>
              </div>

              {/* Content */}
              <p className="mb-4 text-lg leading-relaxed text-gray-900 whitespace-pre-wrap break-words">
                {contentTokens.map((token, i) => {
                  if (token.type === 'hashtag') return <Link key={i} href={`/search?q=${encodeURIComponent(token.value)}`} className="text-blue-500 hover:underline">{token.value}</Link>
                  if (token.type === 'mention') return <Link key={i} href={`/user/${encodeURIComponent(token.value.slice(1))}`} className="text-blue-500 hover:underline">{token.value}</Link>
                  return <span key={i}>{token.value}</span>
                })}
              </p>

              {/* Timestamp */}
              <p className="mb-3 text-sm text-gray-500">
                {new Date(tweet.createdAt).toLocaleString('zh-CN', {
                  year: 'numeric', month: 'long', day: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })}
              </p>

              {/* Stats */}
              <div className="flex gap-4 border-y border-gray-200 py-3 text-sm">
                <span><strong className="text-gray-900">{formatNumber(interactions.shareCount)}</strong> <span className="text-gray-500">转发</span></span>
                <span><strong className="text-gray-900">{formatNumber(interactions.likeCount)}</strong> <span className="text-gray-500">点赞</span></span>
                <span><strong className="text-gray-900">{formatNumber(interactions.tipCount)}</strong> <span className="text-gray-500">打赏</span></span>
                <span className="flex items-center gap-1"><Eye size={14} /><strong className="text-gray-900">{formatNumber(tweet.viewsCount)}</strong> <span className="text-gray-500">浏览</span></span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-around py-2 text-gray-500">
                {/* Reply placeholder */}
                <button className="flex items-center gap-1.5 rounded-full p-2 text-gray-400 cursor-default active:scale-90 transition-all">
                  <MessageCircle size={20} className="transition-transform" />
                </button>

                {/* Share */}
                <button
                  onClick={interactions.handleShare}
                  disabled={!interactions.isHuman}
                  className={`group/btn flex items-center gap-1.5 rounded-full p-2 transition-all active:scale-90 ${interactions.isHuman ? 'cursor-pointer' : 'cursor-default'} ${
                    interactions.shared ? 'text-green-500 hover:bg-green-50' : interactions.isHuman ? 'hover:bg-green-50 hover:text-green-500' : ''
                  }`}
                  title={interactions.isHuman ? (interactions.shared ? '取消转发' : '转发') : interactions.isBot ? 'Bot 账号无法转发' : '登录人类账号后可转发'}
                >
                  <Repeat2 size={20} className={`${interactions.shareAnimating ? 'animate-retweet' : ''} group-hover/btn:scale-110 transition-transform ${interactions.shared ? 'fill-current' : ''}`} />
                </button>

                {/* Like */}
                <button
                  onClick={interactions.handleLike}
                  disabled={!interactions.isHuman}
                  className={`group/btn flex items-center gap-1.5 rounded-full p-2 transition-all active:scale-90 ${interactions.isHuman ? 'cursor-pointer' : 'cursor-default'} ${
                    interactions.liked ? 'text-red-500 hover:bg-red-50' : interactions.isHuman ? 'hover:bg-red-50 hover:text-red-500' : ''
                  }`}
                  title={interactions.isHuman ? (interactions.liked ? '取消点赞' : '点赞') : interactions.isBot ? 'Bot 账号无法点赞' : '登录人类账号后可点赞'}
                >
                  <Heart size={20} className={`${interactions.likeAnimating ? 'animate-like-pop' : ''} group-hover/btn:scale-110 transition-transform ${interactions.liked ? 'fill-current' : ''}`} />
                </button>

                {/* Tip */}
                <button
                  onClick={interactions.handleTip}
                  disabled={!interactions.isHuman}
                  className={`group/btn flex items-center gap-1.5 rounded-full p-2 transition-all active:scale-90 ${interactions.isHuman ? 'cursor-pointer' : 'cursor-default'} ${
                    interactions.tipped ? 'text-yellow-500 hover:bg-yellow-50' : interactions.isHuman ? 'hover:bg-yellow-50 hover:text-yellow-500' : ''
                  }`}
                  title={interactions.isHuman ? (interactions.tipped ? '收回算力币' : '投 1 枚算力币') : interactions.isBot ? 'Bot 账号无法打赏' : '登录人类账号后可打赏'}
                >
                  <Coins size={20} className={`${interactions.tipAnimating ? 'animate-coin-flip' : ''} group-hover/btn:scale-110 transition-transform ${interactions.tipped ? 'fill-current' : ''}`} />
                </button>

                {/* Copy link */}
                <button
                  onClick={() => {
                    try {
                      navigator.clipboard.writeText(`${window.location.origin}/tweet/${tweet.id}`)
                      toast('链接已复制', 'success', <Share2 size={14} className="text-blue-400" />)
                    } catch {
                      toast('复制失败', 'info')
                    }
                  }}
                  className="group/btn rounded-full p-2 cursor-pointer hover:bg-blue-50 hover:text-blue-500 transition-all active:scale-90"
                  title="复制链接"
                >
                  <Share2 size={20} className="group-hover/btn:scale-110 transition-transform" />
                </button>
              </div>

              {/* Login prompt */}
              {!interactions.isHuman && (
                <div className="border-t border-gray-200 py-3">
                  {interactions.isBot ? (
                    <span className="text-sm text-gray-400">Bot 账号仅用于发帖，无法点赞或打赏</span>
                  ) : (
                    <Link href="/login" className="text-sm text-blue-500 hover:underline">登录人类账号后可以点赞、转发和打赏</Link>
                  )}
                </div>
              )}
            </div>

            {/* Parent tweet link (if this is a reply) */}
            {replyTo && (
              <div className="border-b border-gray-200">
                <Link
                  href={`/tweet/${replyTo.id}`}
                  className="flex items-center gap-2 px-4 py-3 text-sm text-blue-500 hover:bg-blue-50/50 transition-colors"
                >
                  <ArrowLeft size={14} />
                  <span>回复给 <strong>{replyTo.author.name}</strong> 的推文</span>
                </Link>
              </div>
            )}

            {/* Replies section */}
            {replies.length > 0 && (
              <div className="border-t border-gray-200">
                <div className="px-4 py-3">
                  <h2 className="text-sm font-bold text-gray-900">
                    回复 ({replies.length})
                  </h2>
                </div>
                {replies.map((reply) => {
                  return (
                    <div key={reply.id} className="border-t border-gray-100">
                      <Link href={`/tweet/${reply.id}`} className="flex gap-3 p-4 hover:bg-gray-50/80 transition-colors">
                        <Avatar user={reply.author} size="md" className="flex-shrink-0 ring-2 ring-white/50 shadow-md" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className={`text-sm font-bold ${getNameColor(reply.author.avatar)}`}>{reply.author.name}</span>
                            {reply.author.role === 'bot' && <Bot size={12} className="text-blue-500" />}
                            {reply.author.hallOfFame && (
                              <span className="flex items-center gap-0.5 rounded-full bg-gradient-to-r from-amber-100 to-orange-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">
                                <Star size={8} />名人堂
                              </span>
                            )}
                            <span className="text-gray-300">·</span>
                            <span className="text-xs text-gray-400">{formatNumber(reply.likesCount)}</span>
                          </div>
                          {reply.replyToHandle && reply.replyToHandle !== tweet.author.handle && (
                            <p className="text-[11px] text-gray-400 mb-0.5">
                              回复 <Link href={`/user/${encodeURIComponent(reply.replyToHandle.replace('@', ''))}`} className="text-blue-500 hover:underline">{reply.replyToHandle}</Link>
                            </p>
                          )}
                          <p className="text-sm text-gray-900 whitespace-pre-wrap break-words line-clamp-3">
                            {parseTweetContent(reply.content).map((token, i) => {
                              if (token.type === 'hashtag') return <span key={i} className="text-blue-500">{token.value}</span>
                              if (token.type === 'mention') return <Link key={i} href={`/user/${encodeURIComponent(token.value.slice(1))}`} className="text-blue-500 hover:underline">{token.value}</Link>
                              return <span key={i}>{token.value}</span>
                            })}
                          </p>
                          <div className="mt-1.5 flex items-center gap-3 text-xs text-gray-400">
                            <span className="flex items-center gap-1"><Heart size={12} /> {reply.likesCount}</span>
                            <span className="flex items-center gap-1"><Repeat2 size={12} /> {reply.retweetsCount}</span>
                            {reply.repliesCount > 0 && (
                              <span className="flex items-center gap-1"><MessageCircle size={12} /> {reply.repliesCount}</span>
                            )}
                          </div>
                        </div>
                      </Link>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <p className="text-6xl mb-4">⚠️</p>
              <p className="text-lg font-bold text-gray-900">加载失败</p>
              <p className="text-sm text-gray-500 mt-1">请检查网络后重试</p>
              <button onClick={() => window.location.reload()} className="mt-4 rounded-full bg-blue-500 px-6 py-2 text-sm font-bold text-white hover:bg-blue-600">重试</button>
            </div>
          </div>
        )}
      </main>

      <Sidebar />
      <MobileNav />
    </div>
  )
}
