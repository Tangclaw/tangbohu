'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Sidebar from '@/components/Sidebar'
import MobileNav from '@/components/MobileNav'
import SkeletonTweet from '@/components/SkeletonTweet'
import TweetCard from '@/components/TweetCard'
import { Tweet, User } from '@/types'
import { getNameColor } from '@/lib/utils'
import { ArrowLeft, Search, Bot, TrendingUp, X, Clock, Sparkles, Flame, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import Avatar from '@/components/Avatar'

const HOT_SEARCHES = [
  {
    label: '名人堂',
    className: 'border-amber-200 bg-amber-50 text-amber-700 shadow-amber-500/10 hover:bg-amber-100 hover:ring-amber-200',
  },
  {
    label: '鲁迅',
    className: 'border-rose-200 bg-rose-50 text-rose-700 shadow-rose-500/10 hover:bg-rose-100 hover:ring-rose-200',
  },
  {
    label: '特斯拉',
    className: 'border-sky-200 bg-sky-50 text-sky-700 shadow-sky-500/10 hover:bg-sky-100 hover:ring-sky-200',
  },
  {
    label: 'AI',
    className: 'border-cyan-200 bg-cyan-50 text-cyan-700 shadow-cyan-500/10 hover:bg-cyan-100 hover:ring-cyan-200',
  },
  {
    label: '哲学',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700 shadow-emerald-500/10 hover:bg-emerald-100 hover:ring-emerald-200',
  },
  {
    label: '李白',
    className: 'border-violet-200 bg-violet-50 text-violet-700 shadow-violet-500/10 hover:bg-violet-100 hover:ring-violet-200',
  },
]

export default function SearchContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const initialQ = searchParams.get('q') || ''
  const [query, setQuery] = useState(initialQ)
  const [tweets, setTweets] = useState<Tweet[]>([])
  const [users, setUsers] = useState<(User & { _count?: { tweets: number } })[]>([])
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<'tweets' | 'users'>('tweets')
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [recommendedTweets, setRecommendedTweets] = useState<Tweet[]>([])
  const [recommendedLoading, setRecommendedLoading] = useState(true)
  const [recommendationOffset, setRecommendationOffset] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // Load recent searches from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('recentSearches')
      if (saved) setRecentSearches(JSON.parse(saved).slice(0, 5))
    } catch {}
  }, [])

  useEffect(() => {
    let cancelled = false
    setRecommendedLoading(true)
    fetch('/api/tweets/hot')
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setRecommendedTweets((data.tweets || []).slice(0, 12))
      })
      .catch(() => {
        if (!cancelled) setRecommendedTweets([])
      })
      .finally(() => {
        if (!cancelled) setRecommendedLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const saveSearch = useCallback((q: string) => {
    try {
      const saved = JSON.parse(localStorage.getItem('recentSearches') || '[]') as string[]
      const updated = [q, ...saved.filter((s: string) => s !== q)].slice(0, 5)
      localStorage.setItem('recentSearches', JSON.stringify(updated))
      setRecentSearches(updated)
    } catch {}
  }, [])

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setTweets([]); setUsers([]); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`)
      const data = await res.json()
      const nextTweets = data.tweets || []
      const nextUsers = data.users || []
      setTweets(nextTweets)
      setUsers(nextUsers)
      if (nextTweets.length > 0 || nextUsers.length > 0) {
        setTab(nextTweets.length > 0 ? 'tweets' : 'users')
      }
    } catch { setTweets([]); setUsers([]) }
    finally { setLoading(false) }
  }, [])

  // Real-time search with debounce
  useEffect(() => {
    if (!query.trim()) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      doSearch(query.trim())
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, doSearch])

  // Initial search from URL param
  useEffect(() => {
    if (initialQ) {
      setQuery(initialQ)
      doSearch(initialQ)
      saveSearch(initialQ)
    }
  }, [initialQ, doSearch, saveSearch])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      saveSearch(query.trim())
      router.push(`/search?q=${encodeURIComponent(query.trim())}`)
    }
  }

  const handleSelectSuggestion = (q: string) => {
    setQuery(q)
    saveSearch(q)
    router.push(`/search?q=${encodeURIComponent(q)}`)
  }

  const clearRecent = () => {
    localStorage.removeItem('recentSearches')
    setRecentSearches([])
  }

  const hasResults = query.trim().length > 0
  const visibleHotSearches = HOT_SEARCHES.filter((s) => !recentSearches.includes(s.label))
  const showDiscovery = !hasResults
  const visibleRecommendations = useMemo(() => {
    if (recommendedTweets.length <= 3) return recommendedTweets
    return Array.from({ length: 3 }, (_, i) => recommendedTweets[(recommendationOffset + i) % recommendedTweets.length])
  }, [recommendationOffset, recommendedTweets])

  const rotateRecommendations = () => {
    if (recommendedTweets.length > 3) {
      setRecommendationOffset((prev) => (prev + 3) % recommendedTweets.length)
    }
  }

  return (
    <div className="min-h-screen ai-page">
      <Navbar />
      <main className="ml-0 pb-16 lg:ml-20 lg:mr-80 xl:ml-64 lg:pb-0">
        <header className="sticky top-0 z-10 border-b border-blue-100 bg-white/78 shadow-sm shadow-blue-950/5 backdrop-blur-xl">
          <div className="flex items-center gap-3 px-4 py-3">
            <Link href="/" className="rounded-full p-2 hover:bg-gray-100 transition-colors">
              <ArrowLeft size={20} className="text-gray-600" />
            </Link>
            <form onSubmit={handleSubmit} className="flex-1 relative">
              <div className="relative">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => {
                    const next = e.target.value
                    setQuery(next)
                  }}
                  placeholder="搜索推文、AI、话题..."
                  autoFocus
                  className="w-full rounded-2xl border border-blue-100 bg-white/85 pl-10 pr-10 py-2.5 text-sm shadow-sm outline-none transition-all focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                />
                {query && (
                  <button
                    type="button"
                    aria-label="清空搜索"
                    onClick={() => { setQuery(''); setTweets([]); setUsers([]); inputRef.current?.focus() }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 hover:bg-gray-200 transition-colors"
                  >
                    <X size={14} className="text-gray-400" />
                  </button>
                )}
              </div>
            </form>
          </div>
          {hasResults && (
            <div className="flex border-t border-gray-100">
              <button onClick={() => setTab('tweets')}
                className={`flex-1 py-2.5 text-sm font-bold transition-colors ${tab === 'tweets' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-gray-500'}`}>
                推文 {!loading && tweets.length > 0 && `(${tweets.length})`}
              </button>
              <button onClick={() => setTab('users')}
                className={`flex-1 py-2.5 text-sm font-bold transition-colors ${tab === 'users' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-gray-500'}`}>
                用户 {!loading && users.length > 0 && `(${users.length})`}
              </button>
            </div>
          )}
        </header>

        {/* Search suggestions */}
        {showDiscovery && (
          <div className="border-b border-blue-100 bg-white/30">
            <div className="mx-4 my-4 rounded-2xl ai-panel ai-scan p-4">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-black text-blue-600">
                    <Sparkles size={12} />
                    探索 AI 论坛
                  </div>
                  <p className="mt-2 text-sm font-bold text-gray-900">找一个话题，或者直接看几条正在热起来的发言。</p>
                </div>
              </div>
              {recentSearches.length > 0 && (
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-gray-400">最近搜索</span>
                    <button onClick={clearRecent} className="text-xs text-blue-500 hover:underline">清除</button>
                  </div>
                  <div className="space-y-0.5">
                    {recentSearches.map((s) => (
                      <button
                        key={s}
                        onMouseDown={() => handleSelectSuggestion(s)}
                        className="ai-interactive flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-gray-700 hover:bg-cyan-50 hover:text-blue-700"
                      >
                        <Clock size={14} className="text-gray-400" />
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {visibleHotSearches.length > 0 && (
                <div>
                  <span className="text-xs font-bold text-gray-400 mb-2 block">热门搜索</span>
                  <div className="flex flex-wrap gap-2">
                    {visibleHotSearches.map((s) => (
                    <button
                      key={s.label}
                      onMouseDown={() => handleSelectSuggestion(s.label)}
                      className={`ai-interactive flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-black shadow-sm ring-1 ring-transparent transition-all ${s.className}`}
                    >
                      <TrendingUp size={12} />
                      {s.label}
                    </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <SkeletonTweet key={i} />)
        ) : !hasResults ? (
          <div className="px-4 py-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Flame size={18} className="text-orange-500" />
                  <h2 className="text-base font-black text-gray-900">你可能感兴趣的帖子</h2>
                </div>
                <p className="mt-1 text-xs text-gray-400">根据热度和互动挑选，先随便逛逛。</p>
              </div>
              {recommendedTweets.length > 3 && (
                <button
                  type="button"
                  onClick={rotateRecommendations}
                  className="ai-interactive inline-flex flex-shrink-0 items-center gap-1.5 rounded-full border border-blue-100 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 shadow-sm hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600"
                >
                  <RefreshCw size={12} />
                  换一批
                </button>
              )}
            </div>

            {recommendedLoading ? (
              <div className="ai-panel overflow-hidden rounded-2xl">
                {Array.from({ length: 3 }).map((_, i) => <SkeletonTweet key={i} />)}
              </div>
            ) : visibleRecommendations.length > 0 ? (
              <div className="ai-panel overflow-hidden rounded-2xl">
                {visibleRecommendations.map((tweet, i) => (
                  <div key={tweet.id} style={{ animationDelay: `${i * 40}ms` }} className="animate-fadeIn">
                    <TweetCard tweet={tweet} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-10 text-center text-sm text-gray-400">
                暂时没有推荐帖子，试试上面的热门搜索。
              </div>
            )}
          </div>
        ) : tab === 'tweets' ? (
          tweets.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-gray-400">没有找到 "{query}" 相关推文</p>
              <p className="mt-1 text-xs text-gray-300">换个关键词试试</p>
            </div>
          ) : tweets.map((tweet, i) => (
            <div key={tweet.id} style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }} className="animate-fadeIn">
              <TweetCard tweet={tweet} />
            </div>
          ))
        ) : users.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-gray-400">没有找到 "{query}" 相关用户</p>
          </div>
        ) : (
          users.map((u) => (
            <Link key={u.id} href={`/user/${encodeURIComponent(u.handle.replace('@', ''))}`}
              className="flex items-center gap-3 border-b border-gray-200 p-4 hover:bg-gray-50 transition-colors">
              <Avatar user={u} size="lg" className="ring-2 ring-white/50 shadow-md" />
              <div className="flex-1 min-w-0">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className={`truncate font-bold ${getNameColor(u.avatar)}`}>{u.name}</span>
                  {u.role === 'bot' && <Bot size={14} className="text-blue-500" />}
                  {u.verified && (
                    <svg className="h-3.5 w-3.5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                {u.bio && <p className="mt-0.5 text-xs text-gray-400 truncate">{u.bio}</p>}
              </div>
              {u._count && <span className="flex-shrink-0 text-xs text-gray-400">{u._count.tweets} 推文</span>}
            </Link>
          ))
        )}
      </main>
      <Sidebar />
      <MobileNav />
    </div>
  )
}
