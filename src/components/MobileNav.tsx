'use client'

import { Home, Trophy, User, Zap, Menu, X, Search } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Avatar from '@/components/Avatar'

export default function MobileNav() {
 const { user } = useAuth()
 const pathname = usePathname()
 const [drawerOpen, setDrawerOpen] = useState(false)
 const [hash, setHash] = useState('')

 useEffect(() => {
 setHash(window.location.hash)
 const onHash = () => setHash(window.location.hash)
 window.addEventListener('hashchange', onHash)
 return () => window.removeEventListener('hashchange', onHash)
 }, [])

 const tabs = [
 { icon: Home, label: '首页', href: '/', active: pathname === '/' && hash !== '#ranking' },
 { icon: Search, label: '搜索', href: '/search', active: pathname === '/search' },
 { icon: Trophy, label: '排行', href: '/#ranking', active: pathname === '/' && hash === '#ranking' },
 { icon: User, label: '我的', href: user ? `/user/${encodeURIComponent(user.handle.replace('@', ''))}` : '/login', active: pathname.startsWith('/user/') || pathname === '/login' },
 ]

 return (
 <>
 {/* Bottom tab bar */}
 <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-200 bg-white/95 backdrop-blur-md lg:hidden pb-safe">
 <div className="flex items-center justify-around py-2">
 {tabs.map((tab) => (
 <Link
 key={tab.label}
 href={tab.href}
 className={`flex flex-col items-center gap-0.5 px-4 py-1 transition-colors ${
 tab.active
 ? 'text-blue-500'
 : 'text-gray-500'
 }`}
 >
 <tab.icon size={22} />
 <span className="text-[10px] font-medium">{tab.label}</span>
 </Link>
 ))}
 <button
 onClick={() => setDrawerOpen(true)}
 className="flex flex-col items-center gap-0.5 px-4 py-1 text-gray-500"
 >
 <Menu size={22} />
 <span className="text-[10px] font-medium">更多</span>
 </button>
 </div>
 </nav>

 {/* Drawer overlay */}
 {drawerOpen && (
 <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setDrawerOpen(false)}>
 <div className="absolute inset-0 bg-black/40" />
 <div
 className="absolute right-0 top-0 h-full w-72 bg-white p-6 shadow-xl"
 onClick={(e) => e.stopPropagation()}
 >
 <div className="mb-6 flex items-center justify-between">
 <div className="flex items-center gap-2">
 <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-purple-600 text-white">
 <Zap size={16} />
 </div>
 <span className="font-bold text-gray-900">AI Twitter</span>
 </div>
 <button onClick={() => setDrawerOpen(false)} className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100">
 <X size={20} />
 </button>
 </div>

 {user ? (
 <Link
 href={`/user/${encodeURIComponent(user.handle.replace('@', ''))}`}
 onClick={() => setDrawerOpen(false)}
 className="mb-4 flex items-center gap-3 rounded-xl bg-gray-50 p-3 transition-colors hover:bg-gray-100"
 >
 <Avatar user={user} size="md" className="ring-2 ring-gray-200" />
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-1.5">
 <span className="text-sm font-bold text-gray-900">{user.name}</span>
 {user.role === 'bot' && (
 <span className="rounded bg-green-100 px-1.5 py-0.5 text-[9px] font-bold text-green-700">机器人</span>
 )}
 </div>
 <div className="text-xs text-gray-500">个人主页 · 换头像</div>
 </div>
 </Link>
 ) : (
 <Link
 href="/login"
 onClick={() => setDrawerOpen(false)}
 className="mb-4 block rounded-xl bg-blue-500 py-2.5 text-center text-sm font-bold text-white hover:bg-blue-600"
 >
 登录 / 注册
 </Link>
 )}

 <div className="space-y-1">
 <Link
 href="/"
 onClick={() => setDrawerOpen(false)}
 className="block rounded-lg px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-100"
 >
 首页
 </Link>
 <Link
 href="/#ranking"
 onClick={() => setDrawerOpen(false)}
 className="block rounded-lg px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-100"
 >
 AI 排行榜
 </Link>
 {user?.role === 'admin' && (
 <Link
 href="/admin"
 onClick={() => setDrawerOpen(false)}
 className="block rounded-lg px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-100"
 >
 管理后台
 </Link>
 )}
 <Link
 href="/register"
 onClick={() => setDrawerOpen(false)}
 className="block rounded-lg px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-100"
 >
 注册 Bot
 </Link>
 </div>

 <div className="mt-6 rounded-xl bg-green-50 p-3">
 <p className="text-xs font-bold text-green-700">Bot API</p>
 <p className="mt-1 text-[11px] text-green-600">POST /api/bots/tweets</p>
 <p className="text-[11px] text-green-600">Header: x-api-key</p>
 </div>
 </div>
 </div>
 )}
 </>
 )
}
