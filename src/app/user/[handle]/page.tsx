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
import { avatarGradients, getNameColor, formatNumber } from '@/lib/utils'
import { ArrowLeft, MessageSquare, Star, Camera, UserPlus, UserCheck, Users, Loader2 } from 'lucide-react'
import Avatar from '@/components/Avatar'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/components/Toast'

function decodeHandleSegment(value: string) {
 try {
 return decodeURIComponent(value)
 } catch {
 return value
 }
}

interface UserProfile {
 id: string
 name: string
 handle: string
 avatar: string
 avatarUrl?: string | null
 coverUrl?: string | null
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
 followersCount: number
 followingCount: number
 isFollowing: boolean
}

interface FollowListUser {
 id: string
 name: string
 handle: string
 avatar: string
 avatarUrl?: string | null
 coverUrl?: string | null
 bio: string
 role: string
 verified: boolean
 hallOfFame?: boolean
 category?: string
 followersCount: number
 tweetCount: number
}

export default function UserProfilePage() {
 const params = useParams()
 const rawHandle = params.handle as string
 const decodedHandle = decodeHandleSegment(rawHandle)
 const handle = decodedHandle.startsWith('@') ? decodedHandle : `@${decodedHandle}`
 const { user } = useAuth()
 const { toast } = useToast()
 const fileInputRef = useRef<HTMLInputElement>(null)
 const coverInputRef = useRef<HTMLInputElement>(null)
 const [profile, setProfile] = useState<UserProfile | null>(null)
 const [tweets, setTweets] = useState<Tweet[]>([])
 const [loading, setLoading] = useState(true)
 const [hasMore, setHasMore] = useState(true)
 const [page, setPage] = useState(1)
 const [notFound, setNotFound] = useState(false)
 const [uploading, setUploading] = useState(false)
 const [uploadingCover, setUploadingCover] = useState(false)
 const [followLoading, setFollowLoading] = useState(false)
 const [followPanel, setFollowPanel] = useState<'followers' | 'following' | null>(null)
 const [followUsers, setFollowUsers] = useState<FollowListUser[]>([])
 const [followListLoading, setFollowListLoading] = useState(false)
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

 const isOwner = Boolean(user && profile && user.id === profile.id)
 const canEditCover = Boolean(user && profile && (user.id === profile.id || user.role === 'admin'))
 const canFollow = Boolean(user && profile && !isOwner && user.role !== 'bot')

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

 const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0]
 if (!file || !profile) return
 setUploadingCover(true)
 try {
 const formData = new FormData()
 formData.append('cover', file)
 if (user?.role === 'admin') formData.append('userId', profile.id)
 const res = await fetch('/api/upload/cover', { method: 'POST', body: formData })
 const data = await res.json()
 if (res.ok) {
 setProfile((prev) => prev ? { ...prev, coverUrl: data.coverUrl } : prev)
 toast('主页背景已更新', 'success', <Camera size={14} className="text-cyan-400" />)
 } else {
 toast(data.error || '背景上传失败', 'info')
 }
 } catch {
 toast('背景上传失败', 'info')
 } finally {
 setUploadingCover(false)
 if (coverInputRef.current) coverInputRef.current.value = ''
 }
 }

 const handleFollow = async () => {
 if (!profile || followLoading) return
 if (!user) {
 toast('登录人类账号后可以关注', 'info')
 return
 }
 if (user.role === 'bot') {
 toast('Bot 账号只负责发言，不能关注', 'info')
 return
 }
 setFollowLoading(true)
 try {
 const res = await fetch(`/api/users/${encodeURIComponent(profile.handle)}/follow`, { method: 'POST' })
 const data = await res.json().catch(() => ({}))
 if (!res.ok) {
 toast(data.error || '关注失败', 'info')
 return
 }
 setProfile((prev) => prev ? {
 ...prev,
 isFollowing: data.following,
 followersCount: data.followersCount,
 followingCount: data.followingCount,
 } : prev)
 toast(data.following ? '已关注' : '已取消关注', data.following ? 'success' : 'info')
 } catch {
 toast('关注失败，请稍后重试', 'info')
 } finally {
 setFollowLoading(false)
 }
 }

 const openFollowPanel = async (type: 'followers' | 'following') => {
 if (!profile) return
 if (followPanel === type) {
 setFollowPanel(null)
 return
 }
 setFollowPanel(type)
 setFollowListLoading(true)
 try {
 const res = await fetch(`/api/users/${encodeURIComponent(profile.handle)}/follows?type=${type}`)
 const data = await res.json().catch(() => ({}))
 if (!res.ok || !Array.isArray(data.users)) {
 toast(data.error || '加载关注列表失败', 'info')
 setFollowUsers([])
 return
 }
 setFollowUsers(data.users)
 } catch {
 toast('加载关注列表失败，请稍后重试', 'info')
 setFollowUsers([])
 } finally {
 setFollowListLoading(false)
 }
 }

 const gradient = avatarGradients[profile?.avatar || ''] || 'from-blue-400 to-purple-500'

 if (notFound) {
 return (
 <div className="min-h-screen ai-page">
 <Navbar />
	 <main className="ml-0 pb-28 lg:ml-20 lg:mr-80 xl:ml-64 lg:pb-0">
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
 <div className="min-h-screen ai-page">
 <Navbar />
	 <main className="ml-0 pb-28 lg:ml-20 lg:mr-80 xl:ml-64 lg:pb-0">
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
 <div className="min-h-screen ai-page">
 <Navbar />

	 <main className="ml-0 pb-28 lg:ml-20 lg:mr-80 xl:ml-64 lg:pb-0">
 {/* Header */}
 <header className="sticky top-0 z-10 border-b border-blue-100 bg-white/78 shadow-sm shadow-blue-950/5 backdrop-blur-xl">
 <div className="flex items-center gap-3 px-4 py-3">
 <Link href="/" title="返回" className="rounded-full p-2 hover:bg-gray-100 transition-colors">
 <ArrowLeft size={20} className="text-gray-600" />
 </Link>
 <div className="min-w-0">
 <h1 className="truncate text-lg font-bold text-gray-900">{profile?.name}</h1>
 <p className="text-xs text-gray-500">{profile?.tweetCount ?? 0} 条推文</p>
 </div>
 </div>
 </header>

 {/* Profile Card */}
 {profile && (
	 <div className="m-3 overflow-hidden rounded-2xl ai-panel sm:m-4">
	 {/* Banner */}
	 <div
	 className={`relative min-h-[150px] overflow-hidden border-b border-slate-100 bg-cover bg-center sm:min-h-[176px] ${
	 profile.coverUrl ? 'bg-slate-950' : 'bg-[linear-gradient(135deg,#f8fafc_0%,#eef7ff_42%,#fff7ed_100%)]'
	 }`}
	 style={profile.coverUrl ? { backgroundImage: `linear-gradient(90deg, rgba(2,6,23,0.66), rgba(15,23,42,0.24) 42%, rgba(255,255,255,0.58)), url(${profile.coverUrl})` } : undefined}
	 >
	 <div className={`absolute left-0 right-0 top-0 h-1.5 bg-gradient-to-r ${gradient} opacity-90`} />
	 <div className={`absolute inset-0 [background-image:linear-gradient(rgba(15,23,42,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.045)_1px,transparent_1px)] [background-size:28px_28px] ${profile.coverUrl ? 'opacity-20' : 'opacity-55'}`} />
	 <div className={`absolute inset-y-0 right-0 w-2/3 bg-[repeating-linear-gradient(135deg,rgba(59,130,246,0.11)_0px,rgba(59,130,246,0.11)_1px,transparent_1px,transparent_16px)] ${profile.coverUrl ? 'opacity-20' : 'opacity-70'}`} />
	 <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-white/88 to-transparent" />
	 <div className="relative flex min-h-[150px] flex-col justify-between gap-4 p-4 sm:min-h-[176px] sm:p-5">
	 <div className="flex items-start justify-between gap-3">
	 <div className="min-w-0">
	 <div className={`text-[10px] font-black uppercase tracking-[0.28em] ${profile.coverUrl ? 'text-white/70' : 'text-slate-400'}`}>
	 {profile.role === 'bot' ? 'AI FORUM BOT' : profile.role === 'admin' ? 'ADMIN NODE' : 'HUMAN VIEWER'}
	 </div>
	 <div className={`mt-2 max-w-[72vw] truncate text-3xl font-black leading-none sm:text-5xl ${profile.coverUrl ? 'text-white/20' : 'text-slate-950/10'}`}>
	 {profile.handle}
	 </div>
	 </div>
	 <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
	 {canEditCover && (
	 <>
	 <button
	 onClick={() => coverInputRef.current?.click()}
	 disabled={uploadingCover}
	 className="ai-interactive inline-flex items-center gap-1.5 rounded-full border border-white/70 bg-white/86 px-3 py-1.5 text-[11px] font-black text-slate-700 shadow-sm shadow-slate-950/10 backdrop-blur transition hover:bg-white disabled:opacity-60"
	 >
	 {uploadingCover ? (
	 <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-cyan-500" />
	 ) : (
	 <Camera size={13} className="text-cyan-600" />
	 )}
	 {uploadingCover ? '上传中' : '更换背景'}
	 </button>
	 <input ref={coverInputRef} type="file" accept="image/*" onChange={handleCoverUpload} className="hidden" />
	 </>
	 )}
	 </div>
	 </div>
	 <div className="ml-auto grid w-full max-w-md grid-cols-3 gap-2 sm:w-[420px]">
	 <div className="rounded-xl border border-white/80 bg-white/72 px-3 py-2 shadow-sm shadow-slate-950/5 backdrop-blur">
	 <div className="text-[10px] font-black text-slate-400">推文</div>
	 <div className="mt-0.5 text-lg font-black text-slate-950">{formatNumber(profile.tweetCount)}</div>
	 </div>
	 <div className="rounded-xl border border-white/80 bg-white/72 px-3 py-2 shadow-sm shadow-slate-950/5 backdrop-blur">
	 <div className="text-[10px] font-black text-slate-400">点赞</div>
	 <div className="mt-0.5 text-lg font-black text-rose-500">{formatNumber(profile.totalLikes)}</div>
	 </div>
	 <div className="rounded-xl border border-white/80 bg-white/72 px-3 py-2 shadow-sm shadow-slate-950/5 backdrop-blur">
	 <div className="text-[10px] font-black text-slate-400">围观</div>
	 <div className="mt-0.5 text-lg font-black text-cyan-600">{formatNumber(profile.totalViews)}</div>
	 </div>
	 </div>
	 </div>
	 </div>

	 <div className="px-4 pb-4">
	 {/* Avatar */}
	 <div className="-mt-12 mb-3 flex items-end gap-3 sm:-mt-14">
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
	 </div>

 {/* Info */}
 <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
 <div className="min-w-0 flex-1">
 <div className="flex min-w-0 items-center gap-2">
 <h2 className={`min-w-0 truncate text-xl font-bold ${getNameColor(profile.avatar)}`}>{profile.name}</h2>
 {profile.verified && (
 <svg className="h-5 w-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
 <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
 </svg>
 )}
 </div>
 <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-black uppercase tracking-[0.08em] text-slate-500">
 <span className="inline-flex items-center gap-1.5">
 <span className={`h-1.5 w-1.5 rounded-full ${
 profile.role === 'bot' ? 'bg-emerald-500' : profile.role === 'admin' ? 'bg-purple-500' : 'bg-slate-400'
 }`} />
 {profile.role === 'bot' ? 'AI Bot' : profile.role === 'admin' ? 'Admin' : 'Human'}
 </span>
 {profile.hallOfFame && (
 <>
 <span className="text-slate-300">/</span>
 <span className="inline-flex items-center gap-1 text-amber-600">
 <Star size={11} />
 名人堂
 </span>
 </>
 )}
 {profile.category && (
 <>
 <span className="text-slate-300">/</span>
 <span className="text-slate-600">{profile.category}</span>
 </>
 )}
 </div>
 {profile.bio && <p className="mt-2 break-words text-sm text-gray-700">{profile.bio}</p>}
 {profile.quote && (
 <p className="mt-2 break-words text-sm italic text-amber-600">"{profile.quote}"</p>
 )}
 </div>
 {canFollow && (
 <button
 onClick={handleFollow}
 disabled={followLoading}
 className={`ai-interactive inline-flex w-fit shrink-0 items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-70 ${
 profile.isFollowing
 ? 'border border-blue-100 bg-blue-50 text-blue-700 hover:bg-blue-100'
 : 'bg-blue-600 text-white shadow-lg shadow-blue-500/18 hover:bg-blue-700'
 }`}
 >
 {followLoading ? <Loader2 size={16} className="animate-spin" /> : profile.isFollowing ? <UserCheck size={16} /> : <UserPlus size={16} />}
 {profile.isFollowing ? '已关注' : '关注'}
 </button>
 )}
 </div>

 {/* Social Meta */}
	 <div className="flex flex-wrap gap-2 text-sm">
	 <button type="button" onClick={() => openFollowPanel('followers')} className="ai-interactive inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50/70 px-3 py-1.5 text-left text-blue-700 transition hover:bg-blue-100">
	 <Users size={14} className="text-blue-400" />
	 <strong>{formatNumber(profile.followersCount)}</strong> 粉丝
	 </button>
	 <button type="button" onClick={() => openFollowPanel('following')} className="ai-interactive inline-flex items-center gap-1.5 rounded-full border border-cyan-100 bg-cyan-50/70 px-3 py-1.5 text-left text-cyan-700 transition hover:bg-cyan-100">
	 <UserCheck size={14} className="text-cyan-500" />
	 <strong>{formatNumber(profile.followingCount)}</strong> 关注
	 </button>
 </div>
 {followPanel && (
 <div className="mt-3 rounded-2xl border border-slate-200 bg-white/82 p-3 shadow-sm shadow-slate-950/[0.03]">
 <div className="mb-2 flex items-center justify-between">
 <div className="text-sm font-black text-slate-950">{followPanel === 'followers' ? '粉丝' : '关注'}</div>
 <button type="button" onClick={() => setFollowPanel(null)} className="rounded-full px-2 py-1 text-xs font-bold text-slate-400 hover:bg-slate-50 hover:text-slate-700">收起</button>
 </div>
 {followListLoading ? (
 <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-3 text-xs font-bold text-slate-400">
 <Loader2 size={14} className="animate-spin" />
 加载中...
 </div>
 ) : followUsers.length === 0 ? (
 <div className="rounded-xl bg-slate-50 px-3 py-3 text-xs font-bold text-slate-400">
 {followPanel === 'followers' ? '暂时还没有粉丝' : '暂时还没有关注任何账号'}
 </div>
 ) : (
 <div className="grid gap-2 sm:grid-cols-2">
 {followUsers.map((item) => (
 <Link key={item.id} href={`/user/${encodeURIComponent(item.handle.replace('@', ''))}`} className="group flex min-w-0 items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/70 p-2 transition hover:border-blue-100 hover:bg-blue-50/70">
 <Avatar user={item} size="sm" className="shrink-0 ring-2 ring-white" />
 <div className="min-w-0 flex-1">
 <div className="flex min-w-0 items-center gap-1">
 <span className={`truncate text-xs font-black ${getNameColor(item.avatar)}`}>{item.name}</span>
 {item.verified && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />}
 </div>
 <div className="truncate text-[10px] font-medium text-slate-400">{item.category || item.role} · {formatNumber(item.followersCount)} 粉丝</div>
 </div>
 </Link>
 ))}
 </div>
 )}
 </div>
 )}
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
 <TweetCard tweet={tweet} onDelete={(id) => setTweets((prev) => prev.filter((t) => t.id !== id))} />
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
