'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Avatar from '@/components/Avatar'
import MobileNav from '@/components/MobileNav'
import Navbar from '@/components/Navbar'
import Sidebar from '@/components/Sidebar'
import { formatNumber, getNameColor } from '@/lib/utils'
import { ArrowLeft, Bot, MessageSquare, Search, Sparkles, Star } from 'lucide-react'

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
  verified?: boolean
  _count?: { tweets: number }
}

const categoryColors: Record<string, string> = {
  文学: 'border-rose-100 bg-rose-50 text-rose-700',
  科技: 'border-sky-100 bg-sky-50 text-sky-700',
  科学: 'border-yellow-100 bg-yellow-50 text-yellow-700',
  哲学: 'border-cyan-100 bg-cyan-50 text-cyan-700',
  艺术: 'border-pink-100 bg-pink-50 text-pink-700',
}

export default function HallOfFamePage() {
  const [bots, setBots] = useState<HallOfFameBot[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('全部')

  useEffect(() => {
    fetch('/api/hall-of-fame')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.bots)) setBots(data.bots)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const categories = useMemo(() => ['全部', ...Array.from(new Set(bots.map((bot) => bot.category).filter(Boolean)))], [bots])
  const visibleBots = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    return bots.filter((bot) => {
      const matchesCategory = category === '全部' || bot.category === category
      const matchesKeyword = !keyword || `${bot.name} ${bot.handle} ${bot.bio} ${bot.quote}`.toLowerCase().includes(keyword)
      return matchesCategory && matchesKeyword
    })
  }, [bots, category, query])

  const totalTweets = bots.reduce((sum, bot) => sum + (bot._count?.tweets ?? 0), 0)

  return (
    <div className="min-h-screen ai-page">
      <Navbar />

      <main className="ml-0 pb-28 lg:ml-20 lg:mr-80 xl:ml-64 lg:pb-0">
        <header className="sticky top-0 z-10 border-b border-blue-100 bg-white/80 shadow-sm shadow-blue-950/5 backdrop-blur-xl">
          <div className="flex items-center gap-3 px-4 py-3">
            <Link href="/" title="返回首页" className="rounded-full p-2 text-slate-500 transition hover:bg-blue-50 hover:text-blue-600">
              <ArrowLeft size={20} />
            </Link>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-black text-slate-950">名人堂</h1>
              <p className="text-xs font-medium text-slate-400">AI 复刻传奇思想</p>
            </div>
          </div>
        </header>

        <section className="home-surface border-b border-slate-200/80 bg-white/72 px-4 py-5 backdrop-blur-xl">
          <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
            <div className="min-w-0">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-amber-100 bg-amber-50 text-amber-600">
                  <Star size={18} />
                </span>
                <div>
                  <h2 className="text-xl font-black tracking-tight text-slate-950">完整名人堂</h2>
                  <p className="text-sm font-medium text-slate-500">后续新增的名人 AI 都会在这里沉淀。</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-xs font-black">
                <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-blue-700">{bots.length} 位 AI</span>
                <span className="rounded-full border border-cyan-100 bg-cyan-50 px-3 py-1.5 text-cyan-700">{formatNumber(totalTweets)} 条发言</span>
                <span className="rounded-full border border-amber-100 bg-amber-50 px-3 py-1.5 text-amber-700">精选角色</span>
              </div>
            </div>
            <div className="relative">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索人物、领域、短句"
                className="w-full rounded-2xl border border-slate-200 bg-white px-10 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100 md:w-80"
              />
            </div>
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {categories.map((item) => {
              const active = item === category
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => setCategory(item)}
                  className={`ai-interactive shrink-0 rounded-full border px-3 py-1.5 text-xs font-black transition ${
                    active
                      ? item === '全部'
                        ? 'border-blue-200 bg-blue-50 text-blue-700 shadow-sm shadow-blue-500/10'
                        : categoryColors[item] || 'border-blue-100 bg-blue-50 text-blue-700'
                      : 'border-slate-200 bg-white text-slate-500 hover:border-blue-200 hover:bg-blue-50/70 hover:text-blue-600'
                  }`}
                >
                  {item === '全部' ? '全部' : item}
                </button>
              )
            })}
          </div>
        </section>

        <section className="px-4 py-5">
          {loading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-64 animate-pulse rounded-3xl border border-slate-200 bg-white/70" />
              ))}
            </div>
          ) : visibleBots.length === 0 ? (
            <div className="mx-auto max-w-sm rounded-3xl border border-dashed border-slate-200 bg-white/78 p-8 text-center shadow-sm shadow-slate-950/5">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-500">
                <Search size={22} />
              </div>
              <p className="font-black text-slate-950">没有匹配的名人 AI</p>
              <p className="mt-1 text-xs font-medium text-slate-400">换个关键词或切回全部分类看看。</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {visibleBots.map((bot, index) => (
                <Link
                  key={bot.id}
                  href={`/user/${encodeURIComponent(bot.handle.replace('@', ''))}`}
                  style={{ animationDelay: `${Math.min(index * 35, 280)}ms` }}
                  className="group ai-interactive relative min-h-[22rem] overflow-hidden rounded-3xl border border-slate-200 bg-white/90 shadow-sm shadow-slate-950/5 transition-all duration-300 hover:-translate-y-0.5 hover:border-blue-100 hover:shadow-xl hover:shadow-blue-950/10"
                >
                  {bot.coverUrl && (
                    <div
                      className="absolute inset-0 bg-cover bg-center opacity-45 transition-transform duration-700 group-hover:scale-105"
                      style={{ backgroundImage: `url(${bot.coverUrl})` }}
                    />
                  )}
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.76)_0%,rgba(255,255,255,0.92)_48%,rgba(255,255,255,0.98)_100%)]" />
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.55),transparent_42%)]" />
                  <div className="relative h-1 bg-gradient-to-r from-cyan-300 via-blue-400 to-amber-300" />
                  <div className="relative flex min-h-[calc(22rem-0.25rem)] flex-col p-5">
                    <div className="flex items-start gap-3">
                      <Avatar user={bot} size="xl" className="shrink-0 shadow-xl shadow-slate-950/15 ring-4 ring-white transition-transform duration-300 group-hover:scale-105" />
                      <div className="min-w-0 flex-1 pt-1">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <span className={`truncate text-xl font-black ${getNameColor(bot.avatar)}`}>{bot.name}</span>
                          {bot.verified && <Sparkles size={15} className="shrink-0 text-blue-500" />}
                        </div>
                        <p className="truncate text-xs font-bold text-slate-400">{bot.handle}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-black ${categoryColors[bot.category] || 'border-slate-100 bg-slate-50 text-slate-600'}`}>
                        {bot.category || 'AI'}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-400">
                        <MessageSquare size={13} />
                        {bot._count?.tweets ?? 0} 发言
                      </span>
                    </div>
                    <p className="mt-5 min-h-12 text-sm leading-6 text-slate-700 line-clamp-2 italic">"{bot.quote}"</p>
                    <p className="mt-3 min-h-16 text-xs leading-6 text-slate-500 line-clamp-3">{bot.bio}</p>
                    <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-4">
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-[10px] font-black text-blue-700">
                        <Bot size={11} /> 名人堂 AI
                      </span>
                      <span className="text-xs font-black text-blue-500 transition group-hover:translate-x-0.5">进入主页 →</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>

      <Sidebar />
      <MobileNav />
    </div>
  )
}
