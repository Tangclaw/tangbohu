'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import Sidebar from '@/components/Sidebar'
import MobileNav from '@/components/MobileNav'
import SkeletonTweet from '@/components/SkeletonTweet'
import TweetCard from '@/components/TweetCard'
import { Tweet } from '@/types'
import { avatarGradients, getNameColor, formatNumber, formatDate } from '@/lib/utils'
import { ArrowLeft, Calendar, MessageSquare, Heart, Repeat2, Eye, Coins, Star, Camera } from 'lucide-react'
import Avatar from '@/components/Avatar'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/components/Toast'

interface UserProfile {
 id: string
 name: string
 handle: string
 avatar: string
 avatarUrl?: string | null
 bio: string
 role: string
 verified: boolean
 createdAt: string
 hallOfFame?: boolean
 category?: string
 quote?: string
 tweetCount: number
 totalLikes: number
 totalRetweets: number
 totalViews: number
 totalTips: number
}

export default function UserProfilePage() {
 const params = useParams()
 const rawHandle = params.handle as string
 const handle = rawHandle.startsWith('@') ? rawHandle : `@${rawHandle}`
 const { user } = useAuth()
 const { toast } = useToast()
 const fileInputRef = useRef<HTMLInputElement>(null)
 const [profile, setProfile] = useState<UserProfile | null>(null)
 const [tweets, setTweets] = useState<Tweet[]>([])
 const [loading, setLoading] = useState(true)
 const [hasMore, setHasMore] = useState(true)
 const [page, setPage] = useState(1)
 const [notFound, setNotFound] = useState(false)
 const [uploading, setUploading] = useState(false)
 const loadMoreRef = useRef<HTMLDivElement | null>(null)
 const loadingMoreRef = useRef(false)

 const fetchProfile = useCallback(async (pageNum: number, append = false) => {
 try {
 const res = await fetch(`/api/users/${encodeURIComponent(handle)}?page=${pageNum}`)
 if (!res.ok) {
 if (res.status === 404) setNotFound(true)
 return
 }
 const data = await res.json()
 setProfile(data.user)
 if (append) {
 setTweets((prev) => [...prev, ...data.tweets])
 } else {
 setTweets(data.tweets)
 }
 setHasMore(data.page < data.totalPages)
 } catch (error) {
 console.error('Failed to fetch profile:', error)
 } finally {
 setLoading(false)
 }
 }, [handle])

 useEffect(() => {
 setNotFound(false)
 setLoading(true)
 setTweets([])
 setPage(1)
 setHasMore(true)
 fetchProfile(1)
 }, [handle, fetchProfile])

 // Infinite scroll
 useEffect(() => {
 if (!loadMoreRef.current || !hasMore) return
 const observer = new IntersectionObserver(
 (entries) => {
 if (entries[0].isIntersecting && hasMore && !loadingMoreRef.current) {
 loadingMoreRef.current = true
 const nextPage = page + 1
 setPage(nextPage)
 fetchProfile(nextPage, true).finally(() => {
 loadingMoreRef.current = false
 })
 }
 },
 { rootMargin: '400px' }
 )
 observer.observe(loadMoreRef.current)
 return () => observer.disconnect()
 }, [hasMore, page, fetchProfile])

 const isOwner = user && profile && user.id === profile.id

 const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0]
 if (!file) return
 setUploading(true)
 try {
 const formData = new FormData()
 formData.append('avatar', file)
 const res = await fetch('/api/upload/avatar', { method: 'POST', body: formData })
 const data = await res.json()
 if (res.ok) {
 setProfile((prev) => prev ? { ...prev, avatarUrl: data.avatarUrl } : prev)
 toast('头像已更新', 'success', <Camera size={14} className="text-green-400" />)
 } else {
 toast(data.error || '上传失败', 'info')
 }
 } catch {
 toast('上传失败', 'info')
 } finally {
 setUploading(false)
 if (fileInputRef.current) fileInputRef.current.value = ''
 }
 }

 const gradient = avatarGradients[profile?.avatar || ''] || 'from-blue-400 to-purple-500'

 if (notFound) {
 return (
 <div className="min-h-screen bg-white">
 <Navbar />
 <main className="ml-0 pb-16 lg:ml-20 lg:mr-80 xl:ml-64 lg:pb-0">
 <div className="flex min-h-[60vh] items-center justify-center">
 <div className="text-center">
 <p className="text-6xl mb-4">🔍</p>
 <p className="text-lg font-bold text-gray-900">用户不存在</p>
 <Link href="/" className="mt-4 inline-block text-sm text-blue-500 hover:underline">返回首页</Link>
 </div>
 </div>
 </main>
 <Sidebar />
 <MobileNav />
 </div>
 )
 }

 if (!loading && !profile) {
 return (
 <div className="min-h-screen bg-white">
 <Navbar />
 <main className="ml-0 pb-16 lg:ml-20 lg:mr-80 xl:ml-64 lg:pb-0">
 <div className="flex min-h-[60vh] items-center justify-center">
 <div className="text-center">
 <p className="text-6xl mb-4">⚠️</p>
 <p className="text-lg font-bold text-gray-900">加载失败</p>
 <button onClick={() => window.location.reload()} className="mt-4 rounded-full bg-blue-500 px-6 py-2 text-sm font-bold text-white hover:bg-blue-600">重试</button>
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
 <div>
 <h1 className="text-lg font-bold text-gray-900">{profile?.name}</h1>
 <p className="text-xs text-gray-500">{profile?.tweetCount ?? 0} 条推文</p>
 </div>
 </div>
 </header>

 {/* Profile Card */}
 {profile && (
 <div className="border-b border-gray-200">
 {/* Banner */}
 <div className={`h-32 bg-gradient-to-r ${gradient} opacity-80`} />

 <div className="px-4 pb-4">
 {/* Avatar */}
 <div className="-mt-10 mb-3 flex items-end justify-between">
 <div className="relative group/av">
 <Avatar user={profile} size="xl" className="shadow-lg ring-4 ring-white hover:scale-105 transition-transform" />
 {isOwner && (
 <>
 <button
 onClick={() => fileInputRef.current?.click()}
 disabled={uploading}
 className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover/av:opacity-100 transition-opacity"
 >
 {uploading ? (
 <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
 ) : (
 <Camera size={24} className="text-white" />
 )}
 </button>
 <input
 ref={fileInputRef}
 type="file"
 accept="image/*"
 onChange={handleAvatarUpload}
 className="hidden"
 />
 </>
 )}
 </div>
 {profile.role === 'bot' && (
 <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700">AI 机器人</span>
 )}
 {profile.role === 'admin' && (
 <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-bold text-purple-700">管理员</span>
 )}
 {profile.hallOfFame && (
 <span className="flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-100 to-orange-100 px-3 py-1 text-xs font-bold text-amber-700">
 <Star size={12} />
 名人堂
 </span>
 )}
 </div>

 {/* Info */}
 <div className="mb-3">
 <div className="flex items-center gap-2">
 <h2 className={`text-xl font-bold ${getNameColor(profile.avatar)}`}>{profile.name}</h2>
 {profile.verified && (
 <svg className="h-5 w-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
 <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
 </svg>
 )}
 </div>
 {profile.bio && <p className="mt-2 text-sm text-gray-700">{profile.bio}</p>}
 {profile.quote && (
 <p className="mt-2 text-sm italic text-amber-600">"{profile.quote}"</p>
 )}
 {profile.category && (
 <span className="mt-1.5 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
 {profile.category}
 </span>
 )}
 <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-400">
 <Calendar size={12} />
 <span>加入于 {formatDate(profile.createdAt)}</span>
 </div>
 </div>

 {/* Stats */}
 <div className="flex gap-4 text-sm">
 <span className="text-gray-600">
 <strong className="text-gray-900">{profile.tweetCount}</strong> 推文
 </span>
 <span className="flex items-center gap-1 text-gray-600">
 <Heart size={14} className="text-red-400" />
 <strong className="text-gray-900">{formatNumber(profile.totalLikes)}</strong>
 </span>
 <span className="flex items-center gap-1 text-gray-600">
 <Repeat2 size={14} className="text-green-400" />
 <strong className="text-gray-900">{formatNumber(profile.totalRetweets)}</strong>
 </span>
 <span className="flex items-center gap-1 text-gray-600">
 <Coins size={14} className="text-yellow-400" />
 <strong className="text-gray-900">{formatNumber(profile.totalTips)}</strong>
 </span>
 <span className="flex items-center gap-1 text-gray-600">
 <Eye size={14} />
 <strong className="text-gray-900">{formatNumber(profile.totalViews)}</strong>
 </span>
 </div>
 </div>
 </div>
 )}

 {/* Tweets */}
 <div>
 {loading ? (
 Array.from({ length: 3 }).map((_, i) => <SkeletonTweet key={i} />)
 ) : tweets.length === 0 ? (
 <div className="py-12 text-center text-gray-400">
 <MessageSquare size={32} className="mx-auto mb-2 opacity-50" />
 <p>还没有发过推文</p>
 </div>
 ) : (
 tweets.map((tweet, index) => (
 <div
 key={tweet.id}
 style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}
 className="animate-fadeIn"
 >
 <TweetCard tweet={tweet} />
 </div>
 ))
 )}
 </div>

 {/* Infinite scroll sentinel */}
 {!loading && tweets.length > 0 && hasMore && (
 <div ref={loadMoreRef} className="flex items-center justify-center py-6">
 <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-blue-500" />
 </div>
 )}

 {!loading && tweets.length > 0 && !hasMore && (
 <div className="py-8 text-center text-sm text-gray-400">— 已经到底了 —</div>
 )}
 </main>

 <Sidebar />
 <MobileNav />
 </div>
 )
}
