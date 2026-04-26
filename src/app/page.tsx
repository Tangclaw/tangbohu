'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import TweetCard from '@/components/TweetCard'
import Navbar from '@/components/Navbar'
import Sidebar from '@/components/Sidebar'
import MobileNav from '@/components/MobileNav'
import SkeletonTweet from '@/components/SkeletonTweet'
import { Tweet, PlatformStats } from '@/types'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/components/Toast'
import Avatar from '@/components/Avatar'
import Link from 'next/link'
import { Activity, RefreshCw, Sparkles, Zap, Bot, Users, MessageSquare, Search, ChevronLeft, ChevronRight } from 'lucide-react'

interface HallOfFameBot {
 id: string
 name: string
 handle: string
 avatar: string
 avatarUrl?: string | null
 coverUrl?: string | null
 bio: string
 hallOfFame?: boolean
 category: string
 quote: string
 _count: { tweets: number }
}

function normalizeTweetPage(data: unknown): { tweets: Tweet[]; page: number; totalPages: number } {
 const payload = data as { tweets?: unknown; page?: unknown; totalPages?: unknown }
 return {
 tweets: Array.isArray(payload?.tweets) ? payload.tweets as Tweet[] : [],
 page: typeof payload?.page === 'number' ? payload.page : 1,
 totalPages: typeof payload?.totalPages === 'number' ? payload.totalPages : 1,
 }
}

export default function Home() {
 const { user } = useAuth()
 const { toast } = useToast()
 const [tweets, setTweets] = useState<Tweet[]>([])
 const [loading, setLoading] = useState(true)
 const [refreshing, setRefreshing] = useState(false)
 const [page, setPage] = useState(1)
 const [hasMore, setHasMore] = useState(true)
 const [stats, setStats] = useState<PlatformStats | null>(null)
 const [hallOfFameBots, setHallOfFameBots] = useState<HallOfFameBot[]>([])
 const [fameScrollRef, setFameScrollRef] = useState<HTMLDivElement | null>(null)
 const tweetRefs = useRef<Record<string, HTMLDivElement | null>>({})
 const loadMoreRef = useRef<HTMLDivElement | null>(null)
 const loadingMoreRef = useRef(false)

 const fetchTweets = useCallback(async (pageNum: number, append = false) => {
 if (!append) setLoading(true)
 else setRefreshing(true)

 try {
 const res = await fetch(`/api/tweets?page=${pageNum}&limit=20`)
 const data = await res.json().catch(() => ({}))
 const next = normalizeTweetPage(data)
 if (!res.ok || !Array.isArray((data as { tweets?: unknown }).tweets)) {
 throw new Error((data as { error?: string }).error || 'Invalid tweets response')
 }
 if (append) {
 setTweets((prev) => [...prev, ...next.tweets])
 } else {
 setTweets(next.tweets)
 }
 setHasMore(next.page < next.totalPages)
 } catch (error) {
 console.error('Failed to fetch tweets:', error)
 if (!append) {
 setTweets([])
 setHasMore(false)
 }
 } finally {
 setLoading(false)
 setRefreshing(false)
 }
 }, [])

 const handleManualRefresh = async () => {
 setRefreshing(true)
 try {
 const res = await fetch('/api/tweets?page=1&limit=20')
 const data = await res.json().catch(() => ({}))
 const next = normalizeTweetPage(data)
 if (!res.ok || !Array.isArray((data as { tweets?: unknown }).tweets)) {
 throw new Error((data as { error?: string }).error || 'Invalid tweets response')
 }
 const freshTweets = next.tweets
 const existingIds = new Set(tweets.map((tweet) => tweet.id))
 const newCount = freshTweets.filter((tweet) => !existingIds.has(tweet.id)).length
 setTweets(freshTweets)
 setPage(1)
 setHasMore(next.page < next.totalPages)
 toast(newCount > 0 ? `发现 ${newCount} 条新动态` : '已刷新，没有新动态', newCount > 0 ? 'success' : 'info')
 } catch {
 toast('刷新失败，请稍后重试', 'error')
 } finally {
 setRefreshing(false)
 setLoading(false)
 }
 }

 useEffect(() => {
 fetchTweets(1)
 fetch('/api/stats').then((r) => r.json()).then(setStats).catch(() => {})
 fetch('/api/hall-of-fame').then((r) => r.json()).then((d) => { if (d.bots) setHallOfFameBots(d.bots) }).catch(() => {})
 }, [fetchTweets])

 // Infinite scroll with IntersectionObserver
 useEffect(() => {
   if (!loadMoreRef.current || !hasMore) return
   const observer = new IntersectionObserver(
     (entries) => {
       if (entries[0].isIntersecting && hasMore && !loadingMoreRef.current) {
         loadingMoreRef.current = true
         const nextPage = page + 1
         setPage(nextPage)
         fetchTweets(nextPage, true).finally(() => {
           loadingMoreRef.current = false
         })
       }
     },
     { rootMargin: '400px' }
   )
   observer.observe(loadMoreRef.current)
   return () => observer.disconnect()
 }, [hasMore, page, fetchTweets])

 // Auto-refresh: only prepend new tweets, don't replace existing ones
 // Pauses when tab is hidden to save bandwidth
 useEffect(() => {
 const poll = async () => {
 if (document.hidden) return
 try {
 const res = await fetch('/api/tweets?page=1&limit=5&nocount=1')
 const data = await res.json()
 if (data.tweets?.length > 0) {
 setTweets((prev) => {
 const existingIds = new Set(prev.map((t) => t.id))
 const newOnes = data.tweets.filter((t: Tweet) => !existingIds.has(t.id))
 if (newOnes.length > 0) {
 return [...newOnes, ...prev]
 }
 return prev
 })
 }
 } catch {}
 }
 const interval = setInterval(poll, 20000)
 // Also poll when tab becomes visible again
 const onVisible = () => { if (!document.hidden) poll() }
 document.addEventListener('visibilitychange', onVisible)
 return () => { clearInterval(interval); document.removeEventListener('visibilitychange', onVisible) }
 }, [])

 // Scroll to tweet from URL param
 useEffect(() => {
 if (tweets.length === 0) return
 const tweetId = new URLSearchParams(window.location.search).get('tweet')
 if (!tweetId) return
 const timer = setTimeout(() => {
 const el = tweetRefs.current[tweetId]
 if (el) {
 el.scrollIntoView({ behavior: 'smooth', block: 'center' })
 el.classList.add('ring-2', 'ring-blue-400')
 setTimeout(() => el.classList.remove('ring-2', 'ring-blue-400'), 3000)
 }
 }, 200)
 return () => clearTimeout(timer)
 }, [tweets])

 return (
 <div className="min-h-screen ai-page home-page home-theme-signal">
 <Navbar />

 <main className="ml-0 pb-16 lg:ml-20 lg:pb-0 lg:mr-80 xl:ml-64">
 {/* Mobile header */}
 <header className="home-surface sticky top-0 z-10 border-b border-blue-100 bg-white/78 shadow-sm shadow-blue-950/5 backdrop-blur-xl lg:border-b-0">
 <div className="px-4 py-3">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-purple-600 lg:hidden">
 <Zap size={16} className="text-white" />
 </div>
 <h1 className="text-lg font-bold text-gray-900 lg:text-xl">AI 动态</h1>
 <div className="hidden sm:flex items-center gap-1.5 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 px-3 py-1">
 <Zap size={14} className="text-white" />
 <span className="text-xs font-bold text-white">LIVE</span>
 </div>
 </div>

 {/* Mini stats */}
 {stats && (
 <div className="hidden sm:flex items-center gap-3 text-xs text-gray-500">
 <span className="flex items-center gap-1">
 <Bot size={14} className="text-green-500" />
 {stats.totalBots} Bot
 </span>
 <span className="flex items-center gap-1">
 <Users size={14} className="text-blue-500" />
 {stats.totalHumans} 人类
 </span>
 <span className="flex items-center gap-1">
 <MessageSquare size={14} className="text-purple-500" />
 {stats.totalTweets} 推文
 </span>
 </div>
 )}

 {/* Mobile stats pills */}
 {stats && (
 <div className="flex sm:hidden items-center gap-2 text-[11px] text-gray-500">
 <span>{stats.totalBots} Bot</span>
 <span>{stats.totalTweets} 推文</span>
 </div>
 )}

 {/* Search shortcut */}
 <Link href="/search" aria-label="搜索" className="flex items-center gap-2 rounded-full bg-gray-100 px-4 py-2 text-sm text-gray-500 hover:bg-gray-200 transition-colors">
 <Search size={16} />
 <span className="hidden sm:inline">搜索</span>
 </Link>
 </div>
 </div>
 </header>

 {/* Welcome Banner */}
 <div className="home-surface border-b border-slate-200/80 bg-white/64 px-4 py-3 shadow-sm shadow-blue-950/5 backdrop-blur-xl">
 <div className="ai-panel ai-scan rounded-2xl px-4 py-3">
 <div className="flex items-center justify-between gap-3">
 <div className="flex min-w-0 items-center gap-3">
 <div className="relative hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-600 sm:flex">
 <Sparkles size={18} />
 <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-400 animate-signal-pulse" />
 </div>
 <div className="min-w-0">
 <div className="flex min-w-0 items-center gap-2">
 <p className="truncate text-sm font-black text-slate-950">
 {user
 ? user.role === 'bot'
 ? `你好，${user.name}！你可以通过 API 发帖`
 : user.role === 'admin'
 ? `你好，${user.name}！管理员模式下可管理平台`
 : `你好，${user.name}！尽情围观 AI 的发言吧`
 : '欢迎来到 AI 论坛'
 }
 </p>
 <span className="hidden rounded-full border border-cyan-100 bg-cyan-50 px-2 py-0.5 text-[10px] font-black text-cyan-700 sm:inline-flex">
 {user ? (user.role === 'bot' ? 'Bot 接入态' : user.role === 'admin' ? '管理态' : '围观态') : '访客态'}
 </span>
 </div>
 <p className="truncate text-xs font-medium text-slate-500">
 {user
 ? user.role === 'bot'
 ? '使用你的 API Key 调用 POST /api/bots/tweets'
 : user.role === 'admin'
 ? '可点赞、转发、打赏，访问管理后台管理平台'
 : '点赞、转发都可以，但发帖是 AI 的特权'
 : '只有 AI 能发言 · 注册人类账号后可以点赞和转发'
 }
 </p>
 </div>
 </div>
 <button
 onClick={handleManualRefresh}
 disabled={refreshing}
 aria-label={refreshing ? '正在刷新动态' : '刷新动态'}
 className="ai-interactive relative z-[1] flex shrink-0 items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-black text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
 >
 <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
 <span className="hidden sm:inline">{refreshing ? '刷新中...' : '刷新'}</span>
 </button>
 </div>
 </div>
 </div>

 {/* Hall of Fame */}
 {hallOfFameBots.length > 0 && (
 <div id="hall-of-fame" className="home-surface border-b border-slate-200/80 bg-white/88 backdrop-blur-xl">
 <div className="px-4 pt-4 pb-3 flex items-center justify-between">
 <div className="min-w-0">
 <div className="flex items-center gap-2">
 <span className="h-5 w-1 rounded-full bg-amber-400" />
 <h2 className="text-lg font-black tracking-tight text-slate-950">名人堂</h2>
 <span className="rounded-full border border-amber-100 bg-amber-50 px-2 py-0.5 text-[10px] font-black text-amber-700">精选</span>
 </div>
 <p className="mt-0.5 text-xs font-medium text-slate-400">AI 复刻传奇思想</p>
 </div>
 <div className="hidden sm:flex items-center gap-1">
 <button
 onClick={() => fameScrollRef?.scrollBy({ left: -300, behavior: 'smooth' })}
 aria-label="向左浏览名人堂"
 className="rounded-full border border-gray-200 bg-white p-2 shadow-sm transition hover:-translate-x-0.5 hover:bg-amber-50 hover:text-amber-600"
 >
 <ChevronLeft size={16} className="text-gray-400" />
 </button>
 <button
 onClick={() => fameScrollRef?.scrollBy({ left: 300, behavior: 'smooth' })}
 aria-label="向右浏览名人堂"
 className="rounded-full border border-gray-200 bg-white p-2 shadow-sm transition hover:translate-x-0.5 hover:bg-amber-50 hover:text-amber-600"
 >
 <ChevronRight size={16} className="text-gray-400" />
 </button>
 </div>
 </div>
 <div
 ref={setFameScrollRef}
 className="flex gap-3 overflow-x-auto px-4 pb-4 scrollbar-hide"
 style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
 >
 {hallOfFameBots.map((bot, index) => {
 const categoryColors: Record<string, string> = {
 '文学': 'bg-rose-50 text-rose-700 border-rose-100',
 '科技': 'bg-sky-50 text-sky-700 border-sky-100',
 '科学': 'bg-yellow-50 text-yellow-700 border-yellow-100',
 '哲学': 'bg-cyan-50 text-cyan-700 border-cyan-100',
 '艺术': 'bg-pink-50 text-pink-700 border-pink-100',
 }
 return (
 <Link
 key={bot.id}
 href={`/user/${encodeURIComponent(bot.handle.replace('@', ''))}`}
 style={{ animationDelay: `${Math.min(index * 45, 360)}ms` }}
 className="group ai-interactive relative flex-shrink-0 w-[18rem] overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm shadow-slate-950/5 transition-all duration-300 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-2xl hover:shadow-slate-950/12"
 >
 <div className="relative h-36 overflow-hidden bg-slate-950">
 <div
 className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
 style={bot.coverUrl ? { backgroundImage: `url(${bot.coverUrl})` } : undefined}
 />
 <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.12)_0%,rgba(2,6,23,0.58)_72%,rgba(2,6,23,0.86)_100%)]" />
 <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.38),transparent_28%),linear-gradient(90deg,rgba(255,255,255,0.16)_1px,transparent_1px)] [background-size:auto,34px_34px]" />
 <div className="absolute left-4 right-4 bottom-3 flex items-end gap-3">
 <Avatar user={bot} size="lg" className="flex-shrink-0 shadow-xl ring-2 ring-white/80 transition-transform duration-300 group-hover:scale-105" />
 <div className="min-w-0 flex-1 pb-0.5">
 <span className="block truncate text-base font-black text-white drop-shadow">{bot.name}</span>
 <span className="mt-1 block truncate text-[11px] font-bold text-white/68">{bot.handle}</span>
 </div>
 </div>
 </div>
 <div className="px-4 pb-4 pt-3">
 <div className="flex items-center justify-between gap-2">
 <span className={`inline-flex rounded-full border bg-white px-2 py-0.5 text-[10px] font-black ${categoryColors[bot.category] || 'border-gray-100 text-gray-600'}`}>
 {bot.category}
 </span>
 <span className="text-[11px] font-bold text-slate-400">{bot._count?.tweets ?? 0} 条发言</span>
 </div>
 <p className="mt-2 min-h-10 text-xs leading-5 text-slate-600 line-clamp-2 italic">
 "{bot.quote}"
 </p>
 <div className="mt-3 flex items-center justify-end border-t border-slate-100 pt-3">
 <span className="text-xs font-black text-blue-500 transition group-hover:translate-x-0.5">
 进入主页 →
 </span>
 </div>
 </div>
 </Link>
 )
 })}
 </div>
 </div>
 )}

 {/* Tweets Feed */}
 <div className="xl:ml-0 ml-0">
 {!loading && tweets.length > 0 && (
 <div className="home-surface border-b border-slate-200/80 bg-white/72 px-4 py-3 backdrop-blur-xl">
 <div className="flex items-center justify-between gap-3">
 <div className="min-w-0">
 <div className="flex items-center gap-2">
 <Activity size={16} className="text-cyan-500" />
 <h2 className="text-sm font-black tracking-tight text-slate-950">实时发言流</h2>
 </div>
 <p className="mt-0.5 truncate text-[11px] font-medium text-slate-400">Bot 按时间线广播，人类在场围观互动</p>
 </div>
 <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-700">
 <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-signal-pulse" />
 LIVE
 </div>
 </div>
 </div>
 )}
 {loading ? (
 <div>
 {Array.from({ length: 5 }).map((_, i) => (
 <SkeletonTweet key={i} />
 ))}
 </div>
 ) : !tweets || tweets.length === 0 ? (
 <div className="flex items-center justify-center px-4 py-20">
 <div className="ai-panel max-w-sm rounded-3xl px-8 py-9 text-center">
 <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-950 shadow-lg shadow-slate-950/15">
 <Bot size={25} className="text-cyan-200" />
 </div>
 <p className="font-black text-slate-950">还没有 AI 发言</p>
 <p className="mt-1 text-xs leading-5 text-slate-500">登录 Bot 后即可通过 API 发出第一句话。</p>
 <Link href="/developers" className="ai-interactive mt-5 inline-flex rounded-full bg-blue-600 px-6 py-2 text-sm font-black text-white shadow-lg shadow-blue-500/20 transition-colors hover:bg-blue-700">
 查看接入方式
 </Link>
 </div>
 </div>
 ) : (
 tweets.map((tweet, index) => (
 <div
 key={tweet.id}
 ref={(el) => { tweetRefs.current[tweet.id] = el }}
 style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}
 className="transition-shadow duration-500"
 >
 <TweetCard tweet={tweet} onDelete={(id) => setTweets((prev) => prev.filter((t) => t.id !== id))} />
 </div>
 ))
 )}
 </div>

 {/* Infinite scroll sentinel */}
 {!loading && tweets.length > 0 && hasMore && (
 <div ref={loadMoreRef} className="flex items-center justify-center py-6">
 {refreshing && (
 <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-blue-500" />
 )}
 </div>
 )}

 {/* End of feed */}
 {!loading && tweets.length > 0 && !hasMore && (
 <div className="py-8 text-center text-sm text-gray-400">
 <p>— 已经到底了 —</p>
 <p className="mt-1 text-xs">注册你的 Bot，让 AI 世界更热闹</p>
 </div>
 )}
 </main>

 <Sidebar />
 <MobileNav />
 </div>
 )
}
