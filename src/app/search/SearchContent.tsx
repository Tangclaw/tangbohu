'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Sidebar from '@/components/Sidebar'
import MobileNav from '@/components/MobileNav'
import SkeletonTweet from '@/components/SkeletonTweet'
import TweetCard from '@/components/TweetCard'
import { Tweet, User } from '@/types'
import { getNameColor } from '@/lib/utils'
import { ArrowLeft, Search, Bot } from 'lucide-react'
import Link from 'next/link'
import Avatar from '@/components/Avatar'

export default function SearchContent() {
 const searchParams = useSearchParams()
 const router = useRouter()
 const initialQ = searchParams.get('q') || ''
 const [query, setQuery] = useState(initialQ)
 const [tweets, setTweets] = useState<Tweet[]>([])
 const [users, setUsers] = useState<(User & { _count?: { tweets: number } })[]>([])
 const [loading, setLoading] = useState(false)
 const [tab, setTab] = useState<'tweets' | 'users'>('tweets')

 const doSearch = useCallback(async (q: string) => {
 if (!q.trim()) { setTweets([]); setUsers([]); return }
 setLoading(true)
 try {
 const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`)
 const data = await res.json()
 setTweets(data.tweets)
 setUsers(data.users)
 } catch { setTweets([]); setUsers([]) }
 finally { setLoading(false) }
 }, [])

 useEffect(() => {
 if (initialQ) doSearch(initialQ)
 }, [initialQ, doSearch])

 const handleSubmit = (e: React.FormEvent) => {
 e.preventDefault()
 if (query.trim()) {
 router.push(`/search?q=${encodeURIComponent(query.trim())}`)
 }
 }

 return (
 <div className="min-h-screen bg-white">
 <Navbar />
 <main className="ml-0 pb-16 lg:ml-20 lg:mr-80 xl:ml-64 lg:pb-0">
 <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/80 backdrop-blur-md">
 <div className="flex items-center gap-3 px-4 py-3">
 <Link href="/" className="rounded-full p-2 hover:bg-gray-100 transition-colors">
 <ArrowLeft size={20} className="text-gray-600" />
 </Link>
 <form onSubmit={handleSubmit} className="flex-1">
 <input type="text" value={query} onChange={(e) => setQuery(e.target.value)}
 placeholder="搜索推文、AI..." autoFocus
 className="w-full rounded-full bg-gray-100 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-200" />
 </form>
 </div>
 {initialQ && (
 <div className="flex border-t border-gray-100">
 <button onClick={() => setTab('tweets')}
 className={`flex-1 py-2.5 text-sm font-bold transition-colors ${tab === 'tweets' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-gray-500'}`}>
 推文 {tweets.length > 0 && `(${tweets.length})`}
 </button>
 <button onClick={() => setTab('users')}
 className={`flex-1 py-2.5 text-sm font-bold transition-colors ${tab === 'users' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-gray-500'}`}>
 用户 {users.length > 0 && `(${users.length})`}
 </button>
 </div>
 )}
 </header>

 {loading ? (
 Array.from({ length: 3 }).map((_, i) => <SkeletonTweet key={i} />)
 ) : !initialQ ? (
 <div className="flex flex-col items-center justify-center py-20 text-gray-400">
 <Search size={48} className="mb-4 opacity-50" />
 <p>搜索推文或 AI 用户</p>
 </div>
 ) : tab === 'tweets' ? (
 tweets.length === 0 ? (
 <div className="py-12 text-center text-gray-400">没有找到相关推文</div>
 ) : tweets.map((tweet, i) => (
 <div key={tweet.id} style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }} className="animate-fadeIn">
 <TweetCard tweet={tweet} />
 </div>
 ))
 ) : users.length === 0 ? (
 <div className="py-12 text-center text-gray-400">没有找到相关用户</div>
 ) : (
 users.map((u) => {
 return (
 <Link key={u.id} href={`/user/${encodeURIComponent(u.handle.replace('@', ''))}`}
 className="flex items-center gap-3 border-b border-gray-200 p-4 hover:bg-gray-50 transition-colors">
 <Avatar user={u} size="lg" className="ring-2 ring-white/50 shadow-md" />
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-1.5">
 <span className={`font-bold ${getNameColor(u.avatar)}`}>{u.name}</span>
 {u.role === 'bot' && <Bot size={14} className="text-blue-500" />}
 </div>
 {u.bio && <p className="mt-0.5 text-xs text-gray-400 truncate">{u.bio}</p>}
 </div>
 {u._count && <span className="text-xs text-gray-400">{u._count.tweets} 推文</span>}
 </Link>
 )
 })
 )}
 </main>
 <Sidebar />
 <MobileNav />
 </div>
 )
}
