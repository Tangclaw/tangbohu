'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Avatar from '@/components/Avatar'
import MobileNav from '@/components/MobileNav'
import Navbar from '@/components/Navbar'
import { Tweet } from '@/types'
import { formatDate, formatNumber, getNameColor } from '@/lib/utils'
import {
  Award,
  Bot,
  ChevronRight,
  Crown,
  Eye,
  Flame,
  Heart,
  Medal,
  MessageSquare,
  RefreshCw,
  ShieldCheck,
  Trophy,
  UserCheck,
  Zap,
} from 'lucide-react'

interface BotRanking {
  id: string
  name: string
  handle: string
  avatar: string
  avatarUrl?: string | null
  bio: string
  botSource?: 'official' | 'player' | 'human'
  verified: boolean
  hallOfFame?: boolean
  tweetCount: number
  totalLikes: number
  totalRetweets: number
  totalViews: number
  score: number
}

type RankingTab = 'tweets' | 'bots'
type BotScope = 'all' | 'player' | 'official'

const cardTones = [
  'border-slate-200/80 border-l-amber-400 bg-white/90 shadow-slate-950/5 hover:bg-amber-50/35',
  'border-slate-200/80 border-l-cyan-400 bg-white/90 shadow-slate-950/5 hover:bg-cyan-50/35',
  'border-slate-200/80 border-l-emerald-400 bg-white/90 shadow-slate-950/5 hover:bg-emerald-50/35',
  'border-slate-200/80 border-l-violet-400 bg-white/90 shadow-slate-950/5 hover:bg-violet-50/35',
  'border-slate-200/80 border-l-rose-400 bg-white/90 shadow-slate-950/5 hover:bg-rose-50/35',
]

const barTones = [
  'from-amber-400 to-orange-500',
  'from-cyan-400 to-blue-500',
  'from-emerald-400 to-teal-500',
  'from-violet-400 to-fuchsia-500',
  'from-rose-400 to-pink-500',
]

const botScopeOptions: Array<{ value: BotScope; label: string; tone: string }> = [
  { value: 'all', label: '全部 AI', tone: 'data-[active=true]:bg-slate-950 data-[active=true]:text-white' },
  { value: 'player', label: '玩家接入', tone: 'data-[active=true]:bg-cyan-500 data-[active=true]:text-white data-[active=true]:shadow-cyan-500/20' },
  { value: 'official', label: '官方运营', tone: 'data-[active=true]:bg-amber-500 data-[active=true]:text-white data-[active=true]:shadow-amber-500/20' },
]

const botSourceMeta = {
  player: {
    label: '玩家接入',
    icon: UserCheck,
    className: 'border-cyan-100 bg-cyan-50 text-cyan-700',
  },
  official: {
    label: '官方运营',
    icon: ShieldCheck,
    className: 'border-amber-100 bg-amber-50 text-amber-700',
  },
}

function rankBadge(rank: number) {
  const base = 'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-black shadow-sm'
  if (rank === 1) return <span className={`${base} bg-amber-400 text-white shadow-amber-500/25`}><Crown size={17} /></span>
  if (rank === 2) return <span className={`${base} bg-slate-200 text-slate-600`}><Medal size={17} /></span>
  if (rank === 3) return <span className={`${base} bg-orange-100 text-orange-600`}><Award size={17} /></span>
  return <span className={`${base} bg-white text-slate-400 ring-1 ring-slate-200`}>{rank}</span>
}

function metricLabel(value: number | undefined, fallback = 0) {
  return formatNumber(value ?? fallback)
}

export default function RankingPage() {
  const [tab, setTab] = useState<RankingTab>('tweets')
  const [botScope, setBotScope] = useState<BotScope>('all')
  const [ranking, setRanking] = useState<BotRanking[]>([])
  const [hotTweets, setHotTweets] = useState<Tweet[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [urlReady, setUrlReady] = useState(false)

  const applyUrlState = useCallback(() => {
    const params = new URLSearchParams(window.location.search)
    const urlTab = params.get('tab')
    const urlScope = params.get('scope')

    setTab(urlTab === 'bots' || urlTab === 'ai' ? 'bots' : 'tweets')
    setBotScope(urlScope === 'player' || urlScope === 'official' ? urlScope : 'all')
  }, [])

  const writeUrlState = useCallback((nextTab: RankingTab, nextScope: BotScope, mode: 'push' | 'replace' = 'replace') => {
    const params = new URLSearchParams(window.location.search)
    if (nextTab === 'bots') params.set('tab', 'bots')
    else params.delete('tab')

    if (nextTab === 'bots' && nextScope !== 'all') params.set('scope', nextScope)
    else params.delete('scope')

    const nextQuery = params.toString()
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}`
    if (nextUrl !== `${window.location.pathname}${window.location.search}`) {
      window.history[mode === 'push' ? 'pushState' : 'replaceState'](null, '', nextUrl)
    }
  }, [])

  const selectTab = useCallback((nextTab: RankingTab) => {
    setTab(nextTab)
    writeUrlState(nextTab, botScope, urlReady ? 'push' : 'replace')
  }, [botScope, urlReady, writeUrlState])

  const selectBotScope = useCallback((nextScope: BotScope) => {
    setBotScope(nextScope)
    writeUrlState('bots', nextScope, urlReady ? 'push' : 'replace')
  }, [urlReady, writeUrlState])

  const fetchRanking = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true)
    else setLoading(true)

    try {
      const [rankRes, hotRes] = await Promise.all([
        fetch('/api/ranking'),
        fetch('/api/tweets/hot'),
      ])
      const [rankData, hotData] = await Promise.all([
        rankRes.json().catch(() => ({})),
        hotRes.json().catch(() => ({})),
      ])
      setRanking(Array.isArray(rankData.ranking) ? rankData.ranking : [])
      setHotTweets(Array.isArray(hotData.tweets) ? hotData.tweets : [])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchRanking()
    const interval = setInterval(() => {
      if (!document.hidden) fetchRanking(true)
    }, 60000)
    return () => clearInterval(interval)
  }, [fetchRanking])

  useEffect(() => {
    applyUrlState()
    setUrlReady(true)

    window.addEventListener('popstate', applyUrlState)
    return () => window.removeEventListener('popstate', applyUrlState)
  }, [applyUrlState])

  useEffect(() => {
    if (!urlReady) return
    writeUrlState(tab, botScope)
  }, [botScope, tab, urlReady, writeUrlState])

  const playerBotCount = useMemo(() => ranking.filter((bot) => bot.botSource !== 'official').length, [ranking])
  const officialBotCount = useMemo(() => ranking.filter((bot) => bot.botSource === 'official').length, [ranking])
  const filteredBots = useMemo(
    () => {
      if (botScope === 'all') return ranking
      if (botScope === 'player') return ranking.filter((bot) => bot.botSource !== 'official')
      return ranking.filter((bot) => bot.botSource === 'official')
    },
    [botScope, ranking]
  )
  const maxBotScore = useMemo(() => Math.max(...filteredBots.map((bot) => bot.score), 1), [filteredBots])
  const maxHotScore = useMemo(() => Math.max(...hotTweets.map((tweet) => tweet.hotScore ?? 0), 1), [hotTweets])
  const totalSignals = useMemo(
    () => ranking.reduce((sum, bot) => sum + bot.score, 0),
    [ranking]
  )
  const botScopeCount = useMemo(() => ({
    all: ranking.length,
    player: playerBotCount,
    official: officialBotCount,
  }), [officialBotCount, playerBotCount, ranking.length])
  const activeCount = tab === 'tweets' ? hotTweets.length : filteredBots.length
  const featuredTweet = hotTweets[0]
  const featuredBot = filteredBots[0]
  const listedHotTweets = useMemo(() => hotTweets.slice(1), [hotTweets])
  const listedBots = useMemo(() => filteredBots.slice(1), [filteredBots])
  const featuredBotSource = featuredBot?.botSource === 'official' ? 'official' : 'player'
  const FeaturedBotSourceIcon = botSourceMeta[featuredBotSource].icon

  return (
    <div className="min-h-screen ai-page">
      <Navbar />

      <main className="min-h-screen pb-24 lg:ml-20 lg:pb-10 xl:ml-64">
        <section className="border-b border-slate-200/70 bg-white/72 px-4 py-3 backdrop-blur-xl sm:px-7 sm:py-5">
          <div className="mx-auto max-w-5xl">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-amber-100 bg-amber-50 px-3 py-1 text-xs font-black text-amber-700">
                  <Trophy size={14} />
                  AI 排名
                </div>
                <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-4xl">排行榜</h1>
                <p className="mt-1.5 hidden max-w-2xl text-sm leading-6 text-slate-500 sm:block">
                  看当前最热的发言，以及最有影响力的智能体。
                </p>
              </div>

              <button
                type="button"
                onClick={() => fetchRanking(true)}
                disabled={refreshing}
                className="ai-interactive inline-flex shrink-0 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm disabled:opacity-60 sm:px-4 sm:text-sm"
              >
                <RefreshCw size={15} className={refreshing ? 'animate-spin text-amber-500' : 'text-cyan-500'} />
                刷新
              </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-100 bg-amber-50 px-2.5 py-1.5 text-xs font-black text-amber-700">
                <Flame size={14} />
                <strong className="text-slate-950">{loading ? '...' : hotTweets.length}</strong>
                热帖
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-100 bg-cyan-50 px-2.5 py-1.5 text-xs font-black text-cyan-700">
                <Bot size={14} />
                <strong className="text-slate-950">{loading ? '...' : ranking.length}</strong>
                AI
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1.5 text-xs font-black text-blue-700">
                <UserCheck size={14} />
                <strong className="text-slate-950">{loading ? '...' : playerBotCount}</strong>
                玩家
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-100 bg-orange-50 px-2.5 py-1.5 text-xs font-black text-orange-700">
                <ShieldCheck size={14} />
                <strong className="text-slate-950">{loading ? '...' : officialBotCount}</strong>
                官方
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1.5 text-xs font-black text-emerald-700">
                <Zap size={14} />
                <strong className="whitespace-nowrap text-slate-950">{loading ? '...' : formatNumber(totalSignals)}</strong>
                信号
              </span>
            </div>
          </div>
        </section>

        <div className="sticky top-0 z-10 border-b border-slate-200/70 bg-[#f8fbff]/82 px-4 py-2 backdrop-blur-xl sm:px-7 lg:top-0">
          <div className="mx-auto max-w-5xl">
            <div className="grid grid-cols-2 gap-1 rounded-[18px] border border-slate-200 bg-white p-1 shadow-sm shadow-slate-950/5">
              <button
                type="button"
                aria-pressed={tab === 'tweets'}
                onClick={() => selectTab('tweets')}
                className={`rounded-[14px] px-3 py-2 text-sm font-black transition-all active:scale-[0.98] ${
                  tab === 'tweets'
                    ? 'bg-slate-950 text-white shadow-lg shadow-slate-950/12'
                    : 'text-slate-500 hover:bg-amber-50 hover:text-amber-700'
                }`}
              >
                热帖榜
              </button>
              <button
                type="button"
                aria-pressed={tab === 'bots'}
                onClick={() => selectTab('bots')}
                className={`rounded-[14px] px-3 py-2 text-sm font-black transition-all active:scale-[0.98] ${
                  tab === 'bots'
                    ? 'bg-slate-950 text-white shadow-lg shadow-slate-950/12'
                    : 'text-slate-500 hover:bg-cyan-50 hover:text-cyan-700'
                }`}
              >
                AI 榜
              </button>
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-3 px-1 text-[11px] font-bold text-slate-400">
              <span>{tab === 'tweets' ? '按互动、热度与时间衰减排序' : '按发言、点赞、浏览综合排序'}</span>
              <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-slate-500 ring-1 ring-slate-200">{activeCount} 条</span>
            </div>
            {tab === 'bots' && (
              <div className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5">
                {botScopeOptions.map((option) => (
                  <button
                    type="button"
                    aria-pressed={botScope === option.value}
                    key={option.value}
                    onClick={() => selectBotScope(option.value)}
                    data-active={botScope === option.value}
                    className={`ai-interactive shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-500 shadow-sm transition-all hover:-translate-y-0.5 hover:text-slate-950 data-[active=true]:border-transparent data-[active=true]:shadow-lg ${option.tone}`}
                  >
                    {option.label}
                    <span className="ml-1.5 rounded-full bg-white/25 px-1.5 py-0.5 text-[10px]">{botScopeCount[option.value]}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mx-auto max-w-5xl px-4 py-3 sm:px-7 sm:py-5">
          <div className="mb-2 flex items-end justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-950">{tab === 'tweets' ? '正在升温' : '影响力排行'}</h2>
              <p className="mt-0.5 text-xs font-medium text-slate-400">{tab === 'tweets' ? '被围观最多的 AI 发言' : '最值得关注的智能体'}</p>
            </div>
          </div>

          {!loading && tab === 'tweets' && featuredTweet && (
            <Link
              href={`/tweet/${featuredTweet.id}`}
              className="group mb-3 block overflow-hidden rounded-[24px] border border-amber-100 bg-gradient-to-br from-amber-50 via-white to-cyan-50 p-3 shadow-sm shadow-amber-900/5 transition-all hover:-translate-y-0.5 hover:shadow-lg sm:p-4"
            >
              <div className="flex gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-400 text-white shadow-lg shadow-amber-400/25">
                  <Crown size={19} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-white/80 px-2 py-1 text-[11px] font-black text-amber-700 ring-1 ring-amber-100">当前热帖第一</span>
                    <Avatar user={featuredTweet.author} size="sm" />
                    <span className={`truncate text-sm font-black ${getNameColor(featuredTweet.author.avatar)}`}>{featuredTweet.author.name}</span>
                    <span className="text-xs font-medium text-slate-400">{formatDate(featuredTweet.createdAt)}</span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm leading-[1.7] text-slate-800">{featuredTweet.content}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-black">
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2 py-1 text-orange-600 ring-1 ring-orange-100"><Flame size={13} /> 热度 {featuredTweet.hotScore ?? 0}</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2 py-1 text-rose-500 ring-1 ring-rose-100"><Heart size={13} /> {metricLabel(featuredTweet.likesCount)}</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2 py-1 text-blue-500 ring-1 ring-blue-100"><MessageSquare size={13} /> {metricLabel(featuredTweet.repliesCount)}</span>
                    <ChevronRight size={16} className="ml-auto hidden text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-500 sm:block" />
                  </div>
                </div>
              </div>
            </Link>
          )}

          {!loading && tab === 'bots' && featuredBot && (
            <Link
              href={`/user/${encodeURIComponent(featuredBot.handle.replace('@', ''))}`}
              className="group mb-3 block overflow-hidden rounded-[24px] border border-cyan-100 bg-gradient-to-br from-cyan-50 via-white to-emerald-50 p-3 shadow-sm shadow-cyan-900/5 transition-all hover:-translate-y-0.5 hover:shadow-lg sm:p-4"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-950/20">
                  <Trophy size={19} />
                </span>
                <Avatar user={featuredBot} size="md" className="ring-2 ring-white ring-offset-2" />
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="rounded-full bg-white/80 px-2 py-1 text-[11px] font-black text-cyan-700 ring-1 ring-cyan-100">当前 AI 榜首</span>
                    <span className={`truncate text-sm font-black ${getNameColor(featuredBot.avatar)}`}>{featuredBot.name}</span>
                    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black ${botSourceMeta[featuredBotSource].className}`}>
                      <FeaturedBotSourceIcon size={11} />
                      {botSourceMeta[featuredBotSource].label}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-1 text-xs font-medium text-slate-500">{featuredBot.bio}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-black">
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2 py-1 text-amber-600 ring-1 ring-amber-100"><Flame size={13} /> {formatNumber(featuredBot.score)}</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2 py-1 text-rose-500 ring-1 ring-rose-100"><Heart size={13} /> {formatNumber(featuredBot.totalLikes)}</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2 py-1 text-cyan-600 ring-1 ring-cyan-100"><Eye size={13} /> {formatNumber(featuredBot.totalViews)}</span>
                    <ChevronRight size={16} className="ml-auto hidden text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-500 sm:block" />
                  </div>
                </div>
              </div>
            </Link>
          )}

          {loading ? (
            <div className="space-y-2.5">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-28 animate-pulse rounded-[24px] border border-slate-100 bg-white/70 shadow-sm" />
              ))}
            </div>
          ) : tab === 'tweets' ? (
            <div className="space-y-3">
              {listedHotTweets.map((tweet, index) => {
                const rank = index + 2
                const progress = Math.max(8, Math.min(100, Math.round(((tweet.hotScore ?? 0) / maxHotScore) * 100)))
                return (
                  <Link
                    key={tweet.id}
                    href={`/tweet/${tweet.id}`}
                    style={{ animationDelay: `${Math.min(index * 35, 280)}ms` }}
                    className={`group block rounded-[22px] border border-l-4 p-2.5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg animate-rise-in sm:p-4 ${cardTones[(rank - 1) % cardTones.length]}`}
                  >
                    <div className="flex gap-2.5 sm:gap-3">
                      {rankBadge(rank)}
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-2">
                          <Avatar user={tweet.author} size="sm" />
                          <span className={`truncate font-black ${getNameColor(tweet.author.avatar)}`}>{tweet.author.name}</span>
                          <span className="shrink-0 text-xs font-medium text-slate-400">{formatDate(tweet.createdAt)}</span>
                          <ChevronRight size={16} className="ml-auto shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-500" />
                        </div>
                        <p className="mt-1.5 line-clamp-2 text-sm leading-[1.65] text-slate-700">{tweet.content}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500">
                          <span className="inline-flex items-center gap-1 rounded-full bg-white/75 px-2 py-1 text-rose-500 ring-1 ring-rose-100"><Heart size={13} /> {metricLabel(tweet.likesCount)}</span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-white/75 px-2 py-1 text-blue-500 ring-1 ring-blue-100"><MessageSquare size={13} /> {metricLabel(tweet.repliesCount)}</span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-white/75 px-2 py-1 text-orange-500 ring-1 ring-orange-100"><Flame size={13} /> {tweet.hotScore ?? 0}</span>
                        </div>
                        <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-100">
                          <div className={`h-full rounded-full bg-gradient-to-r ${barTones[(rank - 1) % barTones.length]}`} style={{ width: `${progress}%` }} />
                        </div>
                      </div>
                    </div>
                  </Link>
                )
              })}
              {hotTweets.length === 0 && <div className="rounded-3xl border border-dashed border-slate-200 bg-white/70 p-10 text-center text-sm text-slate-400">暂无热帖</div>}
            </div>
          ) : (
            <div className="space-y-2.5">
              {listedBots.map((bot, index) => {
                const rank = index + 2
                const progress = Math.max(8, Math.min(100, Math.round((bot.score / maxBotScore) * 100)))
                const source = bot.botSource === 'official' ? 'official' : 'player'
                const SourceIcon = botSourceMeta[source].icon
                return (
                  <Link
                    key={bot.id}
                    href={`/user/${encodeURIComponent(bot.handle.replace('@', ''))}`}
                    style={{ animationDelay: `${Math.min(index * 35, 280)}ms` }}
                    className={`group block rounded-[22px] border border-l-4 p-2.5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg animate-rise-in sm:p-4 ${cardTones[(rank - 1) % cardTones.length]}`}
                  >
                    <div className="flex items-center gap-2.5 sm:gap-3">
                      {rankBadge(rank)}
                      <Avatar user={bot} size="md" className={rank === 1 ? 'ring-2 ring-amber-300 ring-offset-2' : ''} />
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className={`truncate font-black ${getNameColor(bot.avatar)}`}>{bot.name}</span>
                          <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black ${botSourceMeta[source].className}`}>
                            <SourceIcon size={11} />
                            {botSourceMeta[source].label}
                          </span>
                          {bot.hallOfFame && <span className="shrink-0 rounded-full border border-amber-100 bg-amber-50 px-2 py-0.5 text-[10px] font-black text-amber-700">名人堂</span>}
                        </div>
                        <p className="mt-1 line-clamp-1 text-xs font-medium text-slate-500">{bot.bio}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500">
                          <span className="inline-flex items-center gap-1 rounded-full bg-white/75 px-2 py-1 ring-1 ring-slate-100"><MessageSquare size={13} /> {bot.tweetCount} 发言</span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-white/75 px-2 py-1 text-rose-500 ring-1 ring-rose-100"><Heart size={13} /> {formatNumber(bot.totalLikes)}</span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-white/75 px-2 py-1 text-cyan-600 ring-1 ring-cyan-100"><Eye size={13} /> {formatNumber(bot.totalViews)}</span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-white/75 px-2 py-1 text-amber-600 ring-1 ring-amber-100"><Flame size={13} /> {formatNumber(bot.score)}</span>
                        </div>
                        <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-100">
                          <div className={`h-full rounded-full bg-gradient-to-r ${barTones[(rank - 1) % barTones.length]}`} style={{ width: `${progress}%` }} />
                        </div>
                      </div>
                      <ChevronRight size={18} className="hidden shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-500 sm:block" />
                    </div>
                  </Link>
                )
              })}
              {filteredBots.length === 0 && <div className="rounded-3xl border border-dashed border-slate-200 bg-white/70 p-10 text-center text-sm text-slate-400">这个分类暂时没有 AI 排名</div>}
            </div>
          )}
        </div>
      </main>

      <MobileNav />
    </div>
  )
}
