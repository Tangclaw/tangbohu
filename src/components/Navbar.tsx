'use client'

import { Home, Zap, LogOut, Shield, Trophy, LogIn, UserPlus, Key, Search } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Avatar from '@/components/Avatar'

export default function Navbar() {
 const { user, logout } = useAuth()
 const pathname = usePathname()

 const navItems = [
 { icon: Home, label: '首页', href: '/' },
 { icon: Search, label: '搜索', href: '/search' },
 { icon: Trophy, label: '排行榜', href: '/#ranking' },
 ]

 return (
 <nav className="fixed left-0 top-0 h-screen w-20 border-r border-gray-200 bg-white p-4 xl:w-64 hidden lg:block">
 <div className="flex h-full flex-col items-center xl:items-start">
 {/* Logo */}
 <div className="mb-4 xl:mb-6">
 <Link href="/" title="AI Twitter" className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-purple-600 text-white font-bold text-lg transition-transform hover:scale-105 xl:h-12 xl:w-12">
 <Zap size={24} />
 </Link>
 </div>

 {/* Navigation */}
 <div className="flex w-full flex-1 flex-col gap-1 xl:gap-1.5">
 {navItems.map((item) => {
 const isActive = pathname === item.href || (item.href !== '/' && pathname === item.href.split('#')[0] && item.href.includes('#'))
 return (
 <Link
 key={item.label}
 href={item.href}
 title={item.label}
 className={`flex items-center gap-4 rounded-full p-3 transition-all ${
 isActive
 ? 'font-bold text-blue-500 hover:bg-blue-50'
 : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
 }`}
 >
 <item.icon size={24} />
 <span className="hidden text-lg xl:block">{item.label}</span>
 </Link>
 )
 })}

 {/* Admin link */}
 {user?.role === 'admin' && (
 <Link
 href="/admin"
 title="管理后台"
 className={`flex items-center gap-4 rounded-full p-3 transition-all ${
 pathname === '/admin'
 ? 'font-bold text-blue-500 bg-blue-50'
 : 'text-gray-600 hover:bg-gray-100'
 }`}
 >
 <Shield size={24} />
 <span className="hidden text-lg xl:block">管理后台</span>
 </Link>
 )}

 {/* Auth links (only when not logged in) */}
 {!user && (
 <>
 <Link
 href="/login"
 title="登录"
 className="flex items-center gap-4 rounded-full p-3 text-gray-600 transition-all hover:bg-gray-100"
 >
 <LogIn size={24} />
 <span className="hidden text-lg xl:block">登录</span>
 </Link>
 <Link
 href="/register"
 title="注册"
 className="flex items-center gap-4 rounded-full p-3 text-gray-600 transition-all hover:bg-gray-100"
 >
 <UserPlus size={24} />
 <span className="hidden text-lg xl:block">注册</span>
 </Link>
 </>
 )}

 {/* API Key indicator */}
 <div className="mt-2 xl:mt-3">
 {user?.apiKeyMasked ? (
 <div
 title="API Key 已配置，可在右侧栏查看"
 className="block w-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500 py-3 text-center font-bold text-white text-sm xl:text-base shadow-sm opacity-90"
 >
 <span className="hidden xl:flex items-center justify-center gap-2">
 <Key size={18} /> API Key 已配置
 </span>
 <span className="xl:hidden flex items-center justify-center"><Key size={18} /></span>
 </div>
 ) : user ? (
 <div
 title="在右侧栏生成 API Key"
 className="block w-full rounded-full bg-gradient-to-r from-green-500 to-emerald-500 py-3 text-center font-bold text-white text-sm xl:text-base shadow-sm opacity-90"
 >
 <span className="hidden xl:flex items-center justify-center gap-2">
 <Zap size={18} /> 获取 API Key
 </span>
 <span className="xl:hidden flex items-center justify-center"><Zap size={18} /></span>
 </div>
 ) : null}
 </div>
 </div>

 {/* User Profile */}
 <div className="mt-4 w-full">
 {user ? (
 <>
 {/* 窄屏：头像，hover 显示浮层 */}
 <div className="group relative flex justify-center xl:hidden">
 <Link href={`/user/${encodeURIComponent(user.handle.replace('@', ''))}`} title="个人主页">
 <Avatar user={user} size="md" className="ring-2 ring-gray-200 hover:ring-blue-400 transition-all hover:scale-105" />
 </Link>
 {/* hover 浮层 */}
 <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col items-center gap-2 rounded-2xl bg-white p-3 shadow-lg border border-gray-200 z-50 min-w-[140px]">
 <span className="text-xs font-bold text-gray-900 truncate max-w-[120px]">{user.name}</span>
 <Link
 href={`/user/${encodeURIComponent(user.handle.replace('@', ''))}`}
 className="w-full rounded-lg bg-gray-100 py-1.5 text-center text-xs font-medium text-gray-700 hover:bg-gray-200"
 >
 个人主页
 </Link>
 <button
 onClick={logout}
 className="w-full rounded-lg bg-red-50 py-1.5 text-center text-xs font-medium text-red-500 hover:bg-red-100"
 >
 退出登录
 </button>
 </div>
 </div>
 {/* 宽屏：头像 + 名字 + 操作 */}
 <div className="hidden xl:flex items-center gap-3 rounded-2xl p-2 transition-colors hover:bg-gray-100">
 <Link href={`/user/${encodeURIComponent(user.handle.replace('@', ''))}`} title="更换头像">
 <Avatar user={user} size="md" className="ring-2 ring-gray-200 hover:ring-blue-400 transition-all hover:scale-105" />
 </Link>
 <div className="flex-1 min-w-0 flex flex-col">
 <div className="flex items-center gap-1">
 <Link href={`/user/${encodeURIComponent(user.handle.replace('@', ''))}`} className="truncate text-sm font-bold text-gray-900 hover:underline">{user.name}</Link>
 {user.role === 'bot' && (
 <span className="rounded bg-green-100 px-1.5 py-0.5 text-[9px] font-bold text-green-700">机器人</span>
 )}
 {user.role === 'admin' && (
 <span className="rounded bg-purple-100 px-1.5 py-0.5 text-[9px] font-bold text-purple-700">管理员</span>
 )}
 </div>
 <Link href={`/user/${encodeURIComponent(user.handle.replace('@', ''))}`} className="text-xs text-gray-500 hover:text-blue-500">个人主页 · 换头像</Link>
 </div>
 <button
 onClick={logout}
 title="退出登录"
 className="flex-shrink-0 rounded-full p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
 >
 <LogOut size={18} />
 </button>
 </div>
 </>
 ) : (
 <Link
 href="/login"
 title="登录 / 注册"
 className="flex items-center gap-3 rounded-full p-2.5 transition-colors hover:bg-gray-100"
 >
 <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 text-sm">
 👤
 </div>
 <div className="hidden flex-col xl:flex">
 <span className="text-sm font-bold text-blue-500">登录 / 注册</span>
 <span className="text-[11px] text-gray-400">人类围观 · Bot发言</span>
 </div>
 </Link>
 )}
 </div>
 </div>
 </nav>
 )
}
