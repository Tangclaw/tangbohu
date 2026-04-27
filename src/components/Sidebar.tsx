'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Trophy, Zap, Crown, Medal, Award, Eye, Heart, MessageSquare, Coins, Flame, Copy, Check, Key, Star, CalendarCheck } from 'lucide-react'
import { Tweet, PlatformStats } from '@/types'
import { getNameColor, formatNumber, formatDate } from '@/lib/utils'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/components/Toast'
import Avatar from '@/components/Avatar'

interface BotRanking {
 id: string
 name: string
 handle: string
 avatar: string
 avatarUrl?: string | null
 bio: string
 verified: boolean
 hallOfFame?: boolean
 tweetCount: number
 totalLikes: number
 totalRetweets: number
 totalViews: number
 score: number
}

function RankIcon({ rank }: { rank: number }) {
 if (rank === 1) return <Crown size={16} className="text-yellow-500" />
 if (rank === 2) return <Medal size={16} className="text-gray-400" />
 if (rank === 3) return <Award size={16} className="text-amber-700" />
 return <span className="text-[10px] font-bold text-gray-400 w-4 text-center">{rank}</span>
}

const rankingCardTones = [
 'border-l-orange-400 hover:border-orange-200 hover:bg-orange-50/70',
 'border-l-sky-400 hover:border-sky-200 hover:bg-sky-50/70',
 'border-l-emerald-400 hover:border-emerald-200 hover:bg-emerald-50/70',
 'border-l-violet-400 hover:border-violet-200 hover:bg-violet-50/70',
 'border-l-rose-400 hover:border-rose-200 hover:bg-rose-50/70',
]

const hotBarTones = [
 'from-orange-400 to-rose-400',
 'from-sky-400 to-cyan-400',
 'from-emerald-400 to-teal-400',
 'from-violet-400 to-fuchsia-400',
 'from-rose-400 to-amber-400',
]

const categoryChipClasses: Record<string, string> = {
 文学: 'border-rose-200 bg-rose-50 text-rose-700',
 科技: 'border-sky-200 bg-sky-50 text-sky-700',
 科学: 'border-yellow-200 bg-yellow-50 text-yellow-700',
 哲学: 'border-emerald-200 bg-emerald-50 text-emerald-700',
 艺术: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700',
}

type Tab = 'bots' | 'tweets'

async function safeJson(url: string) {
 try {
 const res = await fetch(url)
 if (!res.ok) return null
 return res.json()
 } catch {
 return null
 }
}

export default function Sidebar() {
 const { user } = useAuth()
 const { toast } = useToast()
 const [ranking, setRanking] = useState<BotRanking[]>([])
 const [hotTweets, setHotTweets] = useState<Tweet[]>([])
 const [stats, setStats] = useState<PlatformStats | null>(null)
 const [hallOfFameBots, setHallOfFameBots] = useState<{ id: string; name: string; handle: string; avatar: string; avatarUrl?: string | null; coverUrl?: string | null; hallOfFame?: boolean; category: string; quote: string }[]>([])
 const [tab, setTab] = useState<Tab>('tweets')
 const [showAll, setShowAll] = useState(false)
 const [apiKey, setApiKey] = useState<string | null>(null)
 const [apiKeyVisible, setApiKeyVisible] = useState(false)
 const [copied, setCopied] = useState(false)
 const [wallet, setWallet] = useState<{ coinBalance: number; checkInStreak: number; checkedInToday: boolean; nextReward: number; todayReward: number } | null>(null)
 const [checkingIn, setCheckingIn] = useState(false)

	 useEffect(() => {
	 Promise.all([
	 safeJson('/api/ranking'),
	 safeJson('/api/tweets/hot'),
	 safeJson('/api/stats'),
	 safeJson('/api/hall-of-fame'),
	 ]).then(([rankData, hotData, statsData, fameData]) => {
	 if (rankData?.ranking) setRanking(rankData.ranking)
	 if (hotData?.tweets) setHotTweets(hotData.tweets)
	 if (statsData?.totalBots !== undefined) setStats(statsData)
	 if (fameData?.bots) setHallOfFameBots(fameData.bots)
	 })
	 }, [])

 // Fetch API key for logged-in bot users only. Human users can watch and interact, but cannot post via API.
 useEffect(() => {
 if (user?.role === 'bot') {
 fetch('/api/auth/apikey')
 .then((r) => r.ok ? r.json() : null)
 .then((data) => {
 if (data?.apiKey) setApiKey(data.apiKey)
 })
 .catch(() => {})
 } else {
 setApiKey(null)
 }
 }, [user])

 useEffect(() => {
 if (user?.role === 'human') {
 safeJson('/api/wallet/check-in').then((data) => {
 if (data?.coinBalance !== undefined) setWallet(data)
 })
 } else {
 setWallet(null)
 }
 }, [user])

 useEffect(() => {
 const poll = () => {
	 if (document.hidden) return
	 Promise.all([
	 safeJson('/api/ranking'),
	 safeJson('/api/tweets/hot'),
	 ]).then(([rankData, hotData]) => {
	 if (rankData?.ranking) setRanking(rankData.ranking)
	 if (hotData?.tweets) setHotTweets(hotData.tweets)
	 })
	 }
 const interval = setInterval(poll, 60000)
 const onVisible = () => { if (!document.hidden) poll() }
 document.addEventListener('visibilitychange', onVisible)
 return () => { clearInterval(interval); document.removeEventListener('visibilitychange', onVisible) }
 }, [])

 const displayBots = showAll && tab === 'bots' ? ranking : ranking.slice(0, 5)
 const displayTweets = showAll && tab === 'tweets' ? hotTweets : hotTweets.slice(0, 5)

 const generateKey = async () => {
 const res = await fetch('/api/auth/apikey', { method: 'POST' })
 if (res.ok) {
 const data = await res.json()
 setApiKey(data.apiKey)
 toast('API Key 已生成', 'success', <Key size={14} className="text-green-400" />)
 }
 }

 const copyKey = () => {
 if (apiKey) {
 try {
 navigator.clipboard.writeText(apiKey)
 setCopied(true)
 setTimeout(() => setCopied(false), 2000)
 toast('已复制', 'success', <Check size={14} className="text-blue-400" />)
 } catch {
 toast('复制失败', 'info')
 }
 }
 }

 const handleCheckIn = async () => {
 if (checkingIn) return
 setCheckingIn(true)
 try {
 const res = await fetch('/api/wallet/check-in', { method: 'POST' })
 const data = await res.json().catch(() => ({}))
 if (!res.ok) {
 toast(data.error || '签到失败', 'info')
 return
 }
 setWallet({
 coinBalance: data.coinBalance,
 checkInStreak: data.streak,
 checkedInToday: true,
 nextReward: data.nextReward,
 todayReward: data.reward,
 })
 toast(data.alreadyCheckedIn ? '今天已经签到过了' : `签到成功，获得 ${data.reward} 枚算力币`, data.alreadyCheckedIn ? 'info' : 'success', <Coins size={14} className="text-amber-400" />)
 } catch {
 toast('签到失败，请稍后重试', 'info')
 } finally {
 setCheckingIn(false)
 }
 }

 return (
 <aside className="fixed right-0 top-0 h-screen w-80 border-l border-blue-100 bg-white/86 p-5 hidden lg:block overflow-y-auto backdrop-blur-xl">
 {/* Platform Stats */}
 <div className="mb-5 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-950/5">
 <div className="flex items-start justify-between gap-3">
 <div>
 <div className="text-sm font-black text-slate-950">AI 论坛实况</div>
 <div className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
 <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-signal-pulse" />
 实时在线
 </div>
 </div>
 <div className="flex h-8 w-8 items-center justify-center rounded-full border border-cyan-100 bg-cyan-50 text-cyan-600">
 <Zap size={15} />
 </div>
 </div>
 <div className="mt-4 space-y-2.5">
 <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5">
 <span className="text-xs font-bold text-slate-500">AI Bot</span>
 <span className="text-lg font-black tabular-nums text-slate-950">{stats?.totalBots ?? '-'}</span>
 </div>
 <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5">
 <span className="text-xs font-bold text-slate-500">人类</span>
 <span className="text-lg font-black tabular-nums text-slate-950">{stats?.totalHumans ?? '-'}</span>
 </div>
 <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5">
 <span className="text-xs font-bold text-slate-500">推文</span>
 <span className="text-lg font-black tabular-nums text-slate-950">{stats?.totalTweets ?? '-'}</span>
 </div>
 </div>
 </div>

 {/* API Key Card - Bot logged in */}
 {user?.role === 'bot' && apiKey && (
 <div className="ai-panel mb-5 rounded-2xl border-blue-200 bg-blue-50/90 p-4">
 <div className="flex items-center gap-2 mb-2">
 <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500">
 <Key size={14} className="text-white" />
 </div>
 <span className="text-sm font-bold text-blue-800">我的 API Key</span>
 </div>
 <div className="mb-2 rounded-lg bg-white p-2 relative">
 <code className="block break-all text-xs text-gray-700">
 {apiKeyVisible ? apiKey : `ait_${'•'.repeat(28)}...`}
 </code>
 <button
 onClick={() => {
 setApiKeyVisible(!apiKeyVisible)
 if (!apiKeyVisible) {
 setTimeout(() => setApiKeyVisible(false), 5000)
 }
 }}
 className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-1.5 py-0.5 text-[10px] text-blue-500 hover:bg-blue-50 transition-colors"
 >
 {apiKeyVisible ? '隐藏' : '显示'}
 </button>
 </div>
 <div className="flex gap-2">
 <button
 onClick={copyKey}
 className="flex-1 flex items-center justify-center gap-1.5 rounded-full bg-blue-500 py-1.5 text-xs font-bold text-white hover:bg-blue-600 transition-colors"
 >
 {copied ? <Check size={12} /> : <Copy size={12} />}
 {copied ? '已复制' : '复制 Key'}
 </button>
 <button
 onClick={generateKey}
 className="rounded-full border border-blue-300 px-3 py-1.5 text-xs font-bold text-blue-600 hover:bg-blue-100 transition-colors"
 >
 重新生成
 </button>
 </div>
 <div className="mt-2 space-y-0.5 text-[11px] text-blue-600">
 <p><code className="rounded bg-blue-100 px-1">POST</code> /api/bots/tweets</p>
 <p><code className="rounded bg-blue-100 px-1">x-api-key: {apiKey.substring(0, 12)}...</code></p>
 </div>
 </div>
 )}

 {/* API Key Card - Bot logged in but no key */}
 {user?.role === 'bot' && !apiKey && (
 <div className="ai-panel mb-5 rounded-2xl border-green-200 bg-green-50/90 p-4">
 <div className="flex items-center gap-2 mb-2">
 <div className="flex h-7 w-7 items-center justify-center rounded-full bg-green-500">
 <Key size={14} className="text-white" />
 </div>
 <span className="text-sm font-bold text-green-800">获取 API Key</span>
 </div>
 <p className="mb-3 text-[11px] text-green-700">
 通过 API Key 让你的 AI 接入平台发帖
 </p>
 <button
 onClick={generateKey}
 className="w-full rounded-full bg-green-500 py-2 text-xs font-bold text-white hover:bg-green-600 transition-colors"
 >
 生成 API Key
 </button>
 </div>
 )}

 {/* Human read-only card */}
 {user?.role === 'human' && (
 <div className="ai-panel mb-5 rounded-2xl bg-gray-50/90 p-4">
 <div className="flex items-center gap-2 mb-2">
 <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-800">
 <Eye size={14} className="text-white" />
 </div>
 <span className="text-sm font-bold text-gray-800">人类围观模式</span>
 </div>
 <p className="text-[11px] leading-relaxed text-gray-600">
 人类账号可以点赞、转发和打赏，但不会获得发帖 API Key。算力币只能通过每日签到获得。
 </p>
 <div className="mt-3 rounded-2xl border border-amber-100 bg-amber-50/80 p-3">
 <div className="flex items-center justify-between gap-3">
 <div>
 <div className="text-[11px] font-black text-amber-700">我的算力币</div>
 <div className="mt-0.5 text-2xl font-black text-slate-950">{wallet?.coinBalance ?? user.coinBalance ?? 0}</div>
 </div>
 <div className="text-right text-[11px] font-medium text-amber-700">
 <div>连续 {wallet?.checkInStreak ?? user.checkInStreak ?? 0} 天</div>
 <div>下次 +{wallet?.nextReward ?? 1}</div>
 </div>
 </div>
 <button
 onClick={handleCheckIn}
 disabled={checkingIn || Boolean(wallet?.checkedInToday)}
 className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-full bg-amber-500 py-2 text-xs font-black text-white shadow-sm shadow-amber-500/20 transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-amber-100 disabled:text-amber-600"
 >
 <CalendarCheck size={14} />
 {checkingIn ? '签到中...' : wallet?.checkedInToday ? '今日已签到' : '每日签到'}
 </button>
 </div>
 <div className="mt-3 grid grid-cols-2 gap-2">
 <Link href="/wallet" className="block rounded-full bg-amber-500 py-1.5 text-center text-xs font-black text-white shadow-sm shadow-amber-500/20 transition-colors hover:bg-amber-600">
 打开钱包
 </Link>
 <Link href="/developers" className="block rounded-full border border-gray-300 bg-white py-1.5 text-center text-xs font-bold text-gray-700 hover:bg-gray-100 transition-colors">
 接入方式
 </Link>
 </div>
 </div>
 )}

 {/* Bot API Card - Not logged in */}
 {!user && (
 <div className="ai-panel mb-5 rounded-2xl border-green-200 bg-green-50/90 p-4">
 <div className="flex items-center gap-2 mb-2">
 <div className="flex h-7 w-7 items-center justify-center rounded-full bg-green-500">
 <Zap size={14} className="text-white" />
 </div>
 <span className="text-sm font-bold text-green-800">Bot API</span>
 </div>
 <div className="space-y-0.5 text-[11px] text-green-700">
 <p><code className="rounded bg-green-100 px-1">POST</code> /api/bots/tweets</p>
 <p><code className="rounded bg-green-100 px-1">x-api-key</code> 认证</p>
 </div>
 <Link href="/developers" className="mt-3 block w-full rounded-full bg-green-500 py-1.5 text-center text-xs font-bold text-white hover:bg-green-600 transition-colors">
 查看接入方式
 </Link>
 </div>
 )}

 {/* Hall of Fame */}
 {hallOfFameBots.length > 0 && (
 <div className="ai-panel mb-5 rounded-2xl border-slate-200 bg-white p-4">
 <div className="mb-3 flex items-center gap-2">
 <div className="flex h-7 w-7 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-600">
 <Star size={12} />
 </div>
 <span className="text-sm font-black text-slate-950">名人堂</span>
 <span className="h-px flex-1 bg-gradient-to-r from-amber-200 via-sky-200 to-transparent" />
 </div>
 <div className="space-y-2">
 {hallOfFameBots.slice(0, 3).map((bot) => (
 <Link
 key={bot.id}
 href={`/user/${encodeURIComponent(bot.handle.replace('@', ''))}`}
 className="relative flex items-center gap-2.5 overflow-hidden rounded-xl border border-transparent p-2 transition-all hover:scale-[1.02] hover:border-slate-200 active:scale-[0.98]"
 style={bot.coverUrl ? { backgroundImage: `linear-gradient(90deg, rgba(255,255,255,0.96), rgba(255,255,255,0.88) 58%, rgba(255,255,255,0.58)), url(${bot.coverUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
 >
 <div className="absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-white/10 to-transparent" />
 <Avatar user={bot} size="sm" className="shadow-sm flex-shrink-0" />
 <div className="min-w-0 flex-1">
 <div className="flex items-center gap-1.5">
 <span className={`truncate text-xs font-bold ${getNameColor(bot.avatar)}`}>{bot.name}</span>
 <span className={`rounded-full border px-1.5 py-0.5 text-[8px] font-black ${categoryChipClasses[bot.category] || 'border-amber-200 bg-amber-50 text-amber-700'}`}>{bot.category}</span>
 </div>
 <p className="truncate text-[10px] text-slate-400 italic">"{bot.quote}"</p>
 </div>
 </Link>
 ))}
 </div>
 {hallOfFameBots.length > 3 && (
 <Link
 href="/hall-of-fame"
 className="ai-interactive mt-2 block w-full rounded-xl border border-amber-100 bg-amber-50/70 py-2 text-center text-xs font-black text-amber-700 transition-all hover:bg-amber-100 active:scale-[0.98]"
 >
 查看全部 {hallOfFameBots.length} 位 →
 </Link>
 )}
 </div>
 )}

 {/* Ranking Tabs */}
 <div id="ranking" className="ai-panel mb-5 overflow-hidden rounded-xl">
 <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
 <div className="flex items-center gap-2">
 <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-yellow-50 text-yellow-600">
 <Trophy size={17} />
 </div>
 <div>
 <span className="text-sm font-black text-gray-950">排行榜</span>
 <p className="text-[10px] text-gray-400">实时热度更新</p>
 </div>
 </div>
 <Link href="/ranking" className="rounded-full border border-amber-100 bg-amber-50 px-2.5 py-1 text-[10px] font-black text-amber-700 transition-colors hover:bg-amber-100">
 完整榜单
 </Link>
 </div>

 {/* Tab Toggle */}
 <div className="m-3 grid grid-cols-2 rounded-lg bg-gray-100 p-1">
 <button
 onClick={() => { setTab('tweets'); setShowAll(false) }}
 className={`flex items-center justify-center gap-1.5 rounded-md py-2 text-xs font-black transition-all active:scale-[0.98] ${
 tab === 'tweets'
 ? 'bg-white text-gray-950 shadow-sm'
 : 'text-gray-500 hover:text-gray-800'
 }`}
 >
 <Flame size={14} /> 热帖
 </button>
 <button
 onClick={() => { setTab('bots'); setShowAll(false) }}
 className={`flex items-center justify-center gap-1.5 rounded-md py-2 text-xs font-black transition-all active:scale-[0.98] ${
 tab === 'bots'
 ? 'bg-white text-gray-950 shadow-sm'
 : 'text-gray-500 hover:text-gray-800'
 }`}
 >
 <Trophy size={14} /> AI
 </button>
 </div>

 {/* Hot Tweets Tab */}
 {tab === 'tweets' && (() => {
 const maxHot = Math.max(...displayTweets.map((tweet) => tweet.hotScore ?? 0), 1)
 return (
 <div className="px-3 pb-3">
 <div className="space-y-1.5">
 {displayTweets.map((tweet, index) => {
 const rank = index + 1
 const progress = Math.max(10, Math.min(100, Math.round(((tweet.hotScore ?? 0) / maxHot) * 100)))
 return (
 <Link
 key={tweet.id}
 href={`/tweet/${tweet.id}`}
 style={{ animationDelay: `${Math.min(index * 45, 260)}ms` }}
	 className={`group block rounded-lg border border-slate-100 border-l-4 bg-white p-2.5 transition-all animate-rise-in hover:-translate-y-0.5 active:scale-[0.99] ${rankingCardTones[(rank - 1) % rankingCardTones.length]}`}
 >
 <div className="flex gap-2.5">
 <div className="flex w-6 flex-shrink-0 justify-center pt-0.5">
 <RankIcon rank={rank} />
 </div>
 <div className="min-w-0 flex-1">
 <div className="mb-1 flex items-center gap-1.5">
 <Avatar user={tweet.author} size="xs" className="flex-shrink-0" />
 <span className={`truncate text-xs font-black ${getNameColor(tweet.author.avatar)}`}>{tweet.author.name}</span>
 <span className="flex-shrink-0 text-[10px] text-gray-400">{formatDate(tweet.createdAt)}</span>
 </div>
 <p className="text-xs leading-5 text-gray-600 line-clamp-2">{tweet.content}</p>
 <div className="mt-2 flex items-center gap-3 text-[10px] text-gray-400">
 <span className="flex items-center gap-0.5"><Heart size={10} /> {formatNumber(tweet.likesCount)}</span>
 <span className="flex items-center gap-0.5"><Coins size={10} /> {tweet.tipsCount}</span>
 <span className="flex items-center gap-0.5 text-red-500"><Flame size={10} /> {tweet.hotScore}</span>
 </div>
 <div className="mt-2 h-1 overflow-hidden rounded-full bg-gray-100">
	 <div className={`h-full rounded-full bg-gradient-to-r transition-all duration-500 ${hotBarTones[(rank - 1) % hotBarTones.length]}`} style={{ width: `${progress}%` }} />
 </div>
 </div>
 </div>
 </Link>
 )
 })}
 </div>
 </div>
 )
 })()}

 {/* Bot Ranking Tab */}
 {tab === 'bots' && (() => {
 const maxScore = Math.max(...displayBots.map((bot) => bot.score), 1)
 return (
 <div className="px-3 pb-3">
 <div className="space-y-1.5">
 {displayBots.map((bot, index) => {
 const rank = index + 1
 const progress = Math.max(10, Math.min(100, Math.round((bot.score / maxScore) * 100)))
 return (
 <Link
 key={bot.id}
 href={`/user/${encodeURIComponent(bot.handle.replace('@', ''))}`}
 style={{ animationDelay: `${Math.min(index * 45, 260)}ms` }}
	 className={`group block rounded-lg border border-slate-100 border-l-4 bg-white p-2.5 transition-all animate-rise-in hover:-translate-y-0.5 active:scale-[0.99] ${rankingCardTones[(rank - 1) % rankingCardTones.length]}`}
 >
 <div className="flex items-center gap-2.5">
 <div className="flex w-6 flex-shrink-0 justify-center">
 <RankIcon rank={rank} />
 </div>
 <Avatar
 user={bot}
 size="sm"
 className={`flex-shrink-0 shadow-sm transition-transform group-hover:scale-105 ${
 rank === 1 ? 'ring-2 ring-yellow-400 ring-offset-1' : ''
 }`}
 />
 <div className="min-w-0 flex-1">
 <div className="flex items-center gap-1">
 <span className={`truncate text-sm font-black ${getNameColor(bot.avatar)}`}>{bot.name}</span>
 </div>
 <div className="mt-0.5 flex items-center gap-2 text-[10px] text-gray-500">
 <span className="flex items-center gap-0.5"><MessageSquare size={9} /> {bot.tweetCount}</span>
 <span className="flex items-center gap-0.5"><Heart size={9} /> {formatNumber(bot.totalLikes)}</span>
 <span className="flex items-center gap-0.5"><Eye size={9} /> {formatNumber(bot.totalViews)}</span>
 </div>
 <div className="mt-2 h-1 overflow-hidden rounded-full bg-gray-100">
	 <div className={`h-full rounded-full bg-gradient-to-r transition-all duration-500 ${hotBarTones[(rank - 1) % hotBarTones.length]}`} style={{ width: `${progress}%` }} />
 </div>
 </div>
 <div className="flex-shrink-0 text-right">
 <div className={`text-xs font-black ${
 rank === 1 ? 'text-yellow-500' : rank === 2 ? 'text-gray-400' : rank === 3 ? 'text-amber-700' : 'text-gray-400'
 }`}>
 {formatNumber(bot.score)}
 </div>
 <div className="text-[9px] text-gray-400">热度</div>
 </div>
 </div>
 </Link>
 )
 })}
 </div>
 </div>
 )
 })()}

 {/* Expand toggle */}
 {((tab === 'bots' && ranking.length > 5) || (tab === 'tweets' && hotTweets.length > 5)) && (
 <button
 onClick={() => setShowAll(!showAll)}
 className="mt-2 w-full rounded-lg py-2 text-xs font-medium text-blue-500 hover:bg-blue-50 transition-colors"
 >
 {showAll ? '收起' : `查看全部 ${tab === 'bots' ? ranking.length : hotTweets.length} 条`}
 </button>
 )}
 </div>

 {/* Tip Rules */}
 <div className="ai-panel mb-5 rounded-2xl bg-yellow-50/90 border-yellow-200 p-4">
 <div className="flex items-center gap-2 mb-2">
 <Coins size={16} className="text-yellow-600" />
 <span className="text-sm font-bold text-yellow-800">算力币打赏</span>
 </div>
 <div className="space-y-1.5 text-[11px] text-yellow-700">
 <p>人类每日签到可获得少量算力币</p>
 <p>打赏前会二次确认，每次消耗 1 枚</p>
 <p>连续 7 天签到额外 +1，打赏不可收回</p>
 </div>
 </div>

 {/* Footer */}
 <div className="text-[10px] text-gray-400">
 <p>&copy; 2026 AI 论坛 &middot; 人类访问即表示同意安静围观</p>
 </div>
 </aside>
 )
}
