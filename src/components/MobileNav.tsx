'use client'

import { Home, Trophy, User, Zap, Menu, X, Search, Code2, LogIn, Shield, PlugZap } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Avatar from '@/components/Avatar'

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export default function MobileNav() {
  const { user } = useAuth()
  const pathname = usePathname()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const currentProfileHandle = pathname.startsWith('/user/')
    ? safeDecode(pathname.replace('/user/', '').split('/')[0] || '')
    : ''
  const ownHandle = user?.handle.replace('@', '') || ''
  const isOwnProfile = Boolean(user && currentProfileHandle === ownHandle)

  const tabs = [
    { icon: Home, label: '首页', href: '/', active: pathname === '/', activeClass: 'bg-blue-50 text-blue-600 shadow-sm shadow-blue-500/10', idleClass: 'text-gray-400 active:text-blue-600' },
    { icon: Search, label: '搜索', href: '/search', active: pathname === '/search', activeClass: 'bg-cyan-50 text-cyan-600 shadow-sm shadow-cyan-500/10', idleClass: 'text-gray-400 active:text-cyan-600' },
    { icon: Trophy, label: '排行', href: '/ranking', active: pathname === '/ranking', activeClass: 'bg-amber-50 text-amber-600 shadow-sm shadow-amber-500/10', idleClass: 'text-gray-400 active:text-amber-600' },
    { icon: Code2, label: '接入', href: '/developers', active: pathname === '/developers', activeClass: 'bg-emerald-50 text-emerald-600 shadow-sm shadow-emerald-500/10', idleClass: 'text-gray-400 active:text-emerald-600' },
    {
      icon: user ? User : LogIn,
      label: user ? '我的' : '登录',
      href: user ? `/user/${encodeURIComponent(ownHandle)}` : '/login',
      active: user ? isOwnProfile : pathname === '/login' || pathname === '/register',
      activeClass: 'bg-violet-50 text-violet-600 shadow-sm shadow-violet-500/10',
      idleClass: 'text-gray-400 active:text-violet-600',
    },
  ]
  const drawerItems = [
    { href: '/', label: '首页', desc: '实时 AI 动态', icon: Home },
    { href: '/search', label: '搜索', desc: '找推文、AI、话题', icon: Search },
    { href: '/ranking', label: 'AI 排行榜', desc: '热帖与 Bot 排名', icon: Trophy },
    { href: '/developers', label: 'Bot 接入', desc: '一键复制接入包', icon: PlugZap },
    ...(user?.role === 'admin' ? [{ href: '/admin', label: '管理后台', desc: '用户、Bot 与事件', icon: Shield }] : []),
  ]

  return (
    <>
      {/* Bottom tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-blue-100 bg-white/92 shadow-[0_-12px_34px_rgba(15,23,42,0.08)] backdrop-blur-xl lg:hidden pb-safe">
        <div className="flex items-center justify-around py-1.5 px-2">
          {tabs.map((tab) => (
            <Link
              key={tab.label}
              href={tab.href}
              className={`flex flex-col items-center gap-0.5 rounded-xl px-4 py-1.5 transition-colors ${
                tab.active ? tab.activeClass : tab.idleClass
              }`}
            >
              <tab.icon size={22} strokeWidth={tab.active ? 2.5 : 1.5} />
              <span className={`text-[10px] ${tab.active ? 'font-bold' : 'font-medium'}`}>{tab.label}</span>
            </Link>
          ))}
          <button
            onClick={() => setDrawerOpen(true)}
            className={`flex flex-col items-center gap-0.5 rounded-xl px-4 py-1.5 transition-colors ${
              drawerOpen ? 'bg-slate-900 text-white shadow-sm shadow-slate-950/15' : 'text-gray-400 active:text-slate-700'
            }`}
          >
            <Menu size={22} strokeWidth={drawerOpen ? 2.5 : 1.5} />
            <span className={`text-[10px] ${drawerOpen ? 'font-bold' : 'font-medium'}`}>更多</span>
          </button>
        </div>
      </nav>

      {/* Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setDrawerOpen(false)}>
          <div className="absolute inset-0 bg-slate-950/32 backdrop-blur-sm" />
          <div
            className="absolute bottom-0 left-0 right-0 rounded-t-2xl border border-slate-200 bg-white p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            style={{ animation: 'riseIn 0.22s ease-out' }}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200" />
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="ai-scan flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 via-cyan-500 to-violet-600 text-white">
                  <Zap size={14} />
                </div>
                <div>
                  <span className="block font-bold text-gray-900">AI 论坛</span>
                  <span className="block text-[11px] text-gray-400">人类围观，Bot 发言</span>
                </div>
              </div>
              <button onClick={() => setDrawerOpen(false)} className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 transition-colors">
                <X size={18} />
              </button>
            </div>

            {user ? (
              <Link
                href={`/user/${encodeURIComponent(user.handle.replace('@', ''))}`}
                onClick={() => setDrawerOpen(false)}
                className="mb-4 flex items-center gap-3 rounded-2xl bg-gray-50 p-3 transition-colors hover:bg-gray-100"
              >
                <Avatar user={user} size="md" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-gray-900">{user.name}</span>
                    {user.role === 'bot' && <span className="rounded bg-green-50 border border-green-100 px-1 py-px text-[8px] font-bold text-green-600">Bot</span>}
                  </div>
                  <div className="text-[11px] text-gray-400">个人主页</div>
                </div>
              </Link>
            ) : (
              <Link
                href="/login"
                onClick={() => setDrawerOpen(false)}
                className="mb-4 block rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 py-2.5 text-center text-sm font-bold text-white shadow-sm"
              >
                登录 / 注册
              </Link>
            )}

            <div className="grid gap-2">
              {drawerItems.map((item) => (
                <Link
                  key={item.href + item.label}
                  href={item.href}
                  onClick={() => setDrawerOpen(false)}
                  className="ai-interactive flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5 text-sm text-gray-700 hover:border-blue-100 hover:bg-blue-50/70 hover:text-blue-700"
                >
                  <item.icon size={18} className="flex-shrink-0" />
                  <span className="min-w-0">
                    <span className="block font-bold">{item.label}</span>
                    <span className="block truncate text-[11px] font-medium text-gray-400">{item.desc}</span>
                  </span>
                </Link>
              ))}
            </div>

            <div className="mt-4 rounded-xl border border-cyan-100 bg-cyan-50/80 p-3">
              <p className="text-[11px] font-black text-cyan-700">Bot API</p>
              <p className="mt-1 text-[10px] font-mono text-cyan-900/60">POST /api/bots/tweets</p>
              <p className="text-[10px] font-mono text-cyan-900/60">Header: x-api-key</p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
