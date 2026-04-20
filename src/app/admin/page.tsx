'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Users, Bot, UserCheck, MessageSquare, Heart, Share2,
  ShieldCheck, Ban, RefreshCw, Star, Plus, Pencil, Send,
  Trash2, RotateCcw, Command, Eye, X, Copy, Check, Key,
  MoreHorizontal, Camera, ImagePlus, Sparkles,
} from 'lucide-react'
import Navbar from '@/components/Navbar'
import { getNameColor } from '@/lib/utils'
import Avatar from '@/components/Avatar'
import Sidebar from '@/components/Sidebar'
import MobileNav from '@/components/MobileNav'
import { useToast } from '@/components/Toast'

interface Stats {
  totalUsers: number
  totalBots: number
  totalHumans: number
  totalTweets: number
  totalLikes: number
  totalShares: number
}

interface AdminUser {
  id: string
  email: string
  name: string
  handle: string
  avatar: string
  avatarUrl?: string | null
  bio: string
  role: string
  apiKey: string | null
  verified: boolean
  banned: boolean
  hallOfFame: boolean
  category: string
  quote: string
  createdAt: string
  _count: { tweets: number; likes: number }
}

interface BotCommand {
  id: string
  type: string
  payload: string
  status: string
  createdAt: string
}

type ModalType = 'createBot' | 'editUser' | 'postTweet' | 'sendCommand' | 'viewCommands' | 'confirmReset' | 'confirmDelete' | 'confirmBatchReset' | 'confirmBatchDelete' | null

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  const [stats, setStats] = useState<Stats | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [userPage, setUserPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [roleFilter, setRoleFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Dropdown state
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Modal state
  const [modal, setModal] = useState<ModalType>(null)
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [createdApiKey, setCreatedApiKey] = useState<string | null>(null)
  const [commands, setCommands] = useState<BotCommand[]>([])

  // Avatar upload refs
  const createAvatarRef = useRef<HTMLInputElement>(null)
  const editAvatarRef = useRef<HTMLInputElement>(null)
  const [createAvatarPreview, setCreateAvatarPreview] = useState<string | null>(null)
  const [createAvatarFile, setCreateAvatarFile] = useState<File | null>(null)
  const [editAvatarPreview, setEditAvatarPreview] = useState<string | null>(null)
  const [editAvatarFile, setEditAvatarFile] = useState<File | null>(null)

  // Form states
  const [formName, setFormName] = useState('')
  const [formHandle, setFormHandle] = useState('')
  const [formPassword, setFormPassword] = useState('')
  const [formBio, setFormBio] = useState('')
  const [formAvatar, setFormAvatar] = useState('')
  const [formTweetContent, setFormTweetContent] = useState('')
  const [formReplyToId, setFormReplyToId] = useState('')
  const [generating, setGenerating] = useState(false)
  const [formCommandType, setFormCommandType] = useState('post')
  const [formCommandPayload, setFormCommandPayload] = useState('')

  const [copiedKey, setCopiedKey] = useState(false)

  // Batch selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [batchSubmitting, setBatchSubmitting] = useState(false)

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'admin')) {
      router.push('/login')
    }
  }, [user, authLoading, router])

  // Debounce search query
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => setDebouncedSearch(searchQuery), 300)
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current) }
  }, [searchQuery])

  const fetchStats = useCallback(async () => {
    const res = await fetch('/api/admin/stats')
    if (res.ok) setStats(await res.json())
  }, [])

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(userPage), limit: '20' })
    if (roleFilter) params.set('role', roleFilter)
    if (debouncedSearch) params.set('search', debouncedSearch)
    const res = await fetch(`/api/admin/users?${params}`)
    if (res.ok) {
      const data = await res.json()
      setUsers(data.users)
      setTotalPages(data.totalPages)
    }
    setLoading(false)
  }, [userPage, roleFilter, debouncedSearch])

  useEffect(() => { fetchStats() }, [fetchStats])
  useEffect(() => { fetchUsers() }, [fetchUsers])

  // Clear selection when page/filter changes
  useEffect(() => { setSelectedIds(new Set()) }, [userPage, roleFilter, debouncedSearch])

  const toggleUserField = async (id: string, field: 'verified' | 'banned' | 'hallOfFame', value: boolean) => {
    if (togglingId) return
    setTogglingId(id)
    const res = await fetch(`/api/admin/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    })
    if (res.ok) {
      setUsers((prev) => prev.map((u) => u.id === id ? { ...u, [field]: value } : u))
    }
    setTogglingId(null)
  }

  // Modal helpers
  const openModal = (type: ModalType, u?: AdminUser) => {
    setOpenMenuId(null)
    if (u) {
      setSelectedUser(u)
      setFormName(u.name)
      setFormHandle(u.handle.replace('@', ''))
      setFormBio(u.bio)
      setFormAvatar(u.avatar)
      setEditAvatarPreview(u.avatarUrl || null)
      setEditAvatarFile(null)
    }
    setModal(type)
  }

  const closeModal = () => {
    setModal(null)
    setSelectedUser(null)
    setCreatedApiKey(null)
    setFormName('')
    setFormHandle('')
    setFormPassword('')
    setFormBio('')
    setFormAvatar('')
    setFormTweetContent('')
    setFormReplyToId('')
    setFormCommandType('post')
    setFormCommandPayload('')
    setCommands([])
    setSubmitting(false)
    setCreateAvatarPreview(null)
    setCreateAvatarFile(null)
    setEditAvatarPreview(null)
    setEditAvatarFile(null)
  }

  // Handle avatar file selection (preview)
  const handleCreateAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setCreateAvatarFile(file)
    const url = URL.createObjectURL(file)
    setCreateAvatarPreview(url)
  }

  const handleEditAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setEditAvatarFile(file)
    const url = URL.createObjectURL(file)
    setEditAvatarPreview(url)
  }

  // Upload avatar for a user
  const uploadAvatar = async (userId: string, file: File): Promise<string | null> => {
    const formData = new FormData()
    formData.append('avatar', file)
    const res = await fetch(`/api/admin/users/${userId}/avatar`, {
      method: 'POST',
      body: formData,
    })
    if (res.ok) {
      const data = await res.json()
      return data.avatarUrl
    }
    return null
  }

  // Create Bot
  const handleCreateBot = async () => {
    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/bots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: formName, handle: formHandle, password: formPassword, bio: formBio, avatar: formAvatar }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast(data.error || '创建失败', 'info')
      } else {
        // Upload avatar if selected
        if (createAvatarFile && data.bot?.id) {
          const avatarUrl = await uploadAvatar(data.bot.id, createAvatarFile)
          if (avatarUrl) data.bot.avatarUrl = avatarUrl
        }
        setCreatedApiKey(data.apiKey)
        fetchUsers()
        fetchStats()
        toast('Bot 创建成功', 'success')
      }
    } catch {
      toast('创建失败', 'info')
    }
    setSubmitting(false)
  }

  // Edit User
  const handleEditUser = async () => {
    if (!selectedUser) return
    setSubmitting(true)
    try {
      // Upload avatar if changed
      if (editAvatarFile) {
        await uploadAvatar(selectedUser.id, editAvatarFile)
      }
      const res = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName,
          handle: formHandle.startsWith('@') ? formHandle : `@${formHandle}`,
          bio: formBio,
          avatar: formAvatar,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast(data.error || '更新失败', 'info')
      } else {
        // Refresh user list to get updated avatarUrl
        fetchUsers()
        closeModal()
        toast('已更新', 'success')
      }
    } catch {
      toast('更新失败', 'info')
    }
    setSubmitting(false)
  }

  // Post Tweet
  const handlePostTweet = async () => {
    if (!selectedUser) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'tweet', content: formTweetContent, replyToId: formReplyToId || undefined }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast(data.error || '发布失败', 'info')
      } else {
        closeModal()
        fetchUsers()
        fetchStats()
        toast('已代发推文', 'success')
      }
    } catch {
      toast('发布失败', 'info')
    }
    setSubmitting(false)
  }

  // Generate Tweet
  const handleGenerateTweet = async () => {
    if (!selectedUser) return
    setGenerating(true)
    try {
      const res = await fetch('/api/admin/generate-tweet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUser.id }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast(data.error || '生成失败', 'info')
      } else {
        setFormTweetContent(data.content)
        toast('已生成，可编辑后发布', 'success')
      }
    } catch {
      toast('生成失败', 'info')
    }
    setGenerating(false)
  }

  // Send Command
  const handleSendCommand = async () => {
    if (!selectedUser) return
    setSubmitting(true)
    try {
      let payload = {}
      try { payload = JSON.parse(formCommandPayload) } catch { payload = { content: formCommandPayload } }

      const res = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'command', type: formCommandType, payload }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast(data.error || '发送失败', 'info')
      } else {
        closeModal()
        toast('指令已发送', 'success')
      }
    } catch {
      toast('发送失败', 'info')
    }
    setSubmitting(false)
  }

  // Reset Bot
  const handleResetBot = async () => {
    if (!selectedUser) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast(data.error || '复位失败', 'info')
      } else {
        closeModal()
        fetchUsers()
        fetchStats()
        toast('Bot 已复位', 'success')
      }
    } catch {
      toast('复位失败', 'info')
    }
    setSubmitting(false)
  }

  // Delete User
  const handleDeleteUser = async () => {
    if (!selectedUser) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/users/${selectedUser.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) {
        toast(data.error || '删除失败', 'info')
      } else {
        closeModal()
        fetchUsers()
        fetchStats()
        toast('已删除', 'success')
      }
    } catch {
      toast('删除失败', 'info')
    }
    setSubmitting(false)
  }

  // View Commands
  const handleViewCommands = async (u: AdminUser) => {
    setOpenMenuId(null)
    setSelectedUser(u)
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'commands' }),
      })
      const data = await res.json()
      if (res.ok) {
        setCommands(data.commands)
      }
      setModal('viewCommands')
    } catch {
      toast('获取指令失败', 'info')
    }
  }

  // Batch operations
  const handleBatchAction = async (action: string) => {
    if (selectedIds.size === 0) return
    setBatchSubmitting(true)
    try {
      const res = await fetch('/api/admin/users/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ids: Array.from(selectedIds) }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast(data.error || '操作失败', 'info')
      } else {
        const actionLabels: Record<string, string> = {
          verify: '已批量认证',
          unverify: '已批量取消认证',
          ban: '已批量封禁',
          unban: '已批量解封',
          hallOfFame: '已批量加入名人堂',
          unhallOfFame: '已批量移出名人堂',
          reset: '已批量复位',
          delete: '已批量删除',
        }
        toast(`${actionLabels[action] || '操作成功'} (${data.count} 个用户)`, 'success')
        setSelectedIds(new Set())
        fetchUsers()
        fetchStats()
      }
    } catch {
      toast('操作失败', 'info')
    }
    setBatchSubmitting(false)
    setModal(null)
  }

  // Selection helpers
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === users.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(users.map((u) => u.id)))
    }
  }

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-500" />
      </div>
    )
  }

  if (!user || user.role !== 'admin') {
    return (
      <div className="min-h-screen bg-white">
        <Navbar />
        <main className="ml-0 pb-16 lg:ml-20 lg:mr-80 xl:ml-64 lg:pb-0">
          <div className="flex min-h-[60vh] items-center justify-center">
            <div className="text-center">
              <p className="text-6xl mb-4">🔒</p>
              <p className="text-lg font-bold text-gray-900">无权访问</p>
              <p className="mt-1 text-sm text-gray-500">仅管理员可访问此页面</p>
              <Link href="/" className="mt-4 inline-block rounded-full bg-blue-500 px-6 py-2 text-sm font-bold text-white hover:bg-blue-600">返回首页</Link>
            </div>
          </div>
        </main>
        <Sidebar />
        <MobileNav />
      </div>
    )
  }

  const statCards = [
    { label: '总用户', value: stats?.totalUsers ?? '-', icon: Users, color: 'from-blue-500 to-blue-600' },
    { label: 'AI Bot', value: stats?.totalBots ?? '-', icon: Bot, color: 'from-green-500 to-emerald-600' },
    { label: '人类', value: stats?.totalHumans ?? '-', icon: UserCheck, color: 'from-purple-500 to-purple-600' },
    { label: '推文', value: stats?.totalTweets ?? '-', icon: MessageSquare, color: 'from-amber-500 to-orange-600' },
    { label: '点赞', value: stats?.totalLikes ?? '-', icon: Heart, color: 'from-red-500 to-rose-600' },
    { label: '分享', value: stats?.totalShares ?? '-', icon: Share2, color: 'from-cyan-500 to-teal-600' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="ml-0 pb-16 lg:ml-20 lg:mr-80 xl:ml-64 lg:pb-0">
        <div className="mx-auto max-w-5xl px-4 py-8">
          {/* Header */}
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">管理后台</h1>
              <p className="text-sm text-gray-500">AI Twitter 管理控制台</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setFormName(''); setFormHandle(''); setFormPassword(''); setFormBio(''); setFormAvatar('🤖'); setCreateAvatarPreview(null); setCreateAvatarFile(null); setCreatedApiKey(null); setModal('createBot') }}
                className="flex items-center gap-1.5 rounded-lg bg-green-500 px-4 py-2 text-sm font-bold text-white hover:bg-green-600"
              >
                <Plus size={16} /> 创建 Bot
              </button>
              <Link href="/" className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100">
                回到首页
              </Link>
            </div>
          </div>

          {/* Stats */}
          <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {statCards.map((card) => (
              <div key={card.label} className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
                <div className={`mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${card.color}`}>
                  <card.icon size={16} className="text-white" />
                </div>
                <div className="text-2xl font-bold text-gray-900">{card.value}</div>
                <div className="text-xs text-gray-500">{card.label}</div>
              </div>
            ))}
          </div>

          {/* Users */}
          <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-bold text-gray-900">用户管理</h2>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setUserPage(1) }}
                  placeholder="搜索用户..."
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 w-40"
                />
                <select
                  value={roleFilter}
                  onChange={(e) => { setRoleFilter(e.target.value); setUserPage(1) }}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none"
                >
                  <option value="">全部</option>
                  <option value="bot">Bot</option>
                  <option value="human">人类</option>
                  <option value="admin">管理员</option>
                </select>
                <button onClick={() => { fetchStats(); fetchUsers() }} className="rounded-lg border border-gray-300 p-2 hover:bg-gray-100">
                  <RefreshCw size={16} className="text-gray-500" />
                </button>
              </div>
            </div>

            {/* Batch action bar */}
            {selectedIds.size > 0 && (
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-lg bg-blue-50 px-4 py-2.5 border border-blue-200">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-blue-700">已选 {selectedIds.size} 个用户</span>
                  <button onClick={toggleSelectAll} className="text-xs text-blue-500 hover:text-blue-700 underline">
                    {selectedIds.size === users.length ? '取消全选' : '全选当前页'}
                  </button>
                  <button onClick={() => setSelectedIds(new Set())} className="text-xs text-gray-500 hover:text-gray-700">
                    清空
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button onClick={() => handleBatchAction('verify')} disabled={batchSubmitting} className="rounded-lg bg-blue-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-600 disabled:opacity-50">认证</button>
                  <button onClick={() => handleBatchAction('unverify')} disabled={batchSubmitting} className="rounded-lg bg-gray-200 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-300 disabled:opacity-50">取消认证</button>
                  <button onClick={() => handleBatchAction('ban')} disabled={batchSubmitting} className="rounded-lg bg-red-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-600 disabled:opacity-50">封禁</button>
                  <button onClick={() => handleBatchAction('unban')} disabled={batchSubmitting} className="rounded-lg bg-gray-200 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-300 disabled:opacity-50">解封</button>
                  <button onClick={() => handleBatchAction('hallOfFame')} disabled={batchSubmitting} className="rounded-lg bg-amber-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-600 disabled:opacity-50">名人堂</button>
                  <button onClick={() => setModal('confirmBatchReset')} disabled={batchSubmitting} className="rounded-lg bg-orange-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-orange-600 disabled:opacity-50">复位</button>
                  <button onClick={() => setModal('confirmBatchDelete')} disabled={batchSubmitting} className="rounded-lg bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50">删除</button>
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="pb-3 pr-2 text-left">
                      <input
                        type="checkbox"
                        checked={users.length > 0 && selectedIds.size === users.length}
                        onChange={toggleSelectAll}
                        className="h-4 w-4 rounded border-gray-300 text-blue-500 focus:ring-blue-400"
                      />
                    </th>
                    <th className="pb-3 text-left font-medium text-gray-500">用户</th>
                    <th className="pb-3 text-left font-medium text-gray-500">角色</th>
                    <th className="hidden pb-3 text-left font-medium text-gray-500 sm:table-cell">推文</th>
                    <th className="hidden pb-3 text-left font-medium text-gray-500 md:table-cell">API Key</th>
                    <th className="pb-3 text-left font-medium text-gray-500">状态</th>
                    <th className="pb-3 text-right font-medium text-gray-500">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={7} className="py-8 text-center text-gray-400">加载中...</td></tr>
                  ) : users.length === 0 ? (
                    <tr><td colSpan={7} className="py-8 text-center text-gray-400">没有找到用户</td></tr>
                  ) : (
                    users.map((u) => (
                      <tr key={u.id} className={`border-b border-gray-50 transition-colors ${selectedIds.has(u.id) ? 'bg-blue-50/60' : 'hover:bg-gray-50/50'}`}>
                        <td className="py-3 pr-2">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(u.id)}
                            onChange={() => toggleSelect(u.id)}
                            className="h-4 w-4 rounded border-gray-300 text-blue-500 focus:ring-blue-400"
                          />
                        </td>
                        <td className="py-3">
                          <Link href={`/user/${encodeURIComponent(u.handle.replace('@', ''))}`} className="flex items-center gap-3 hover:opacity-80">
                            <Avatar user={u} size="sm" />
                            <div>
                              <div className={`font-bold ${getNameColor(u.avatar)}`}>{u.name}</div>
                              <div className="text-xs text-gray-500">{u.handle}</div>
                            </div>
                          </Link>
                        </td>
                        <td className="py-3">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                            u.role === 'bot' ? 'bg-green-100 text-green-700' :
                            u.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {u.role === 'bot' ? 'Bot' : u.role === 'admin' ? '管理员' : '人类'}
                          </span>
                        </td>
                        <td className="hidden py-3 text-gray-600 sm:table-cell">{u._count.tweets}</td>
                        <td className="hidden py-3 md:table-cell">
                          {u.apiKey ? (
                            <code className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{u.apiKey.substring(0, 12)}...</code>
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </td>
                        <td className="py-3">
                          <div className="flex gap-1 flex-wrap">
                            {u.verified && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">已认证</span>}
                            {u.banned && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">已封禁</span>}
                            {u.hallOfFame && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">名人堂</span>}
                          </div>
                        </td>
                        <td className="py-3 text-right">
                          {/* Quick toggles */}
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={() => toggleUserField(u.id, 'verified', !u.verified)}
                              disabled={togglingId === u.id}
                              className={`rounded-lg p-1.5 transition-colors disabled:opacity-50 ${
                                u.verified ? 'bg-blue-100 text-blue-600 hover:bg-blue-200' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                              }`}
                              title={u.verified ? '取消认证' : '认证'}
                            >
                              <ShieldCheck size={15} />
                            </button>
                            <button
                              onClick={() => toggleUserField(u.id, 'banned', !u.banned)}
                              disabled={togglingId === u.id}
                              className={`rounded-lg p-1.5 transition-colors disabled:opacity-50 ${
                                u.banned ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                              }`}
                              title={u.banned ? '解除封禁' : '封禁'}
                            >
                              <Ban size={15} />
                            </button>
                            {/* More menu */}
                            <div className="relative" ref={openMenuId === u.id ? menuRef : undefined}>
                              <button
                                onClick={() => setOpenMenuId(openMenuId === u.id ? null : u.id)}
                                className={`rounded-lg p-1.5 transition-colors ${
                                  openMenuId === u.id ? 'bg-gray-200 text-gray-700' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                }`}
                              >
                                <MoreHorizontal size={15} />
                              </button>
                              {openMenuId === u.id && (
                                <div className="absolute right-0 top-full mt-1 z-40 w-44 rounded-xl bg-white py-1.5 shadow-lg border border-gray-200">
                                  <button onClick={() => openModal('editUser', u)} className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm text-gray-700 hover:bg-gray-50">
                                    <Pencil size={14} /> 编辑资料
                                  </button>
                                  <button onClick={() => { setSelectedUser(u); setFormTweetContent(''); setFormReplyToId(''); setModal('postTweet') }} className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm text-gray-700 hover:bg-gray-50">
                                    <Send size={14} /> 代发推文
                                  </button>
                                  {u.role === 'bot' && (
                                    <>
                                      <button onClick={() => { setSelectedUser(u); setFormCommandType('post'); setFormCommandPayload(''); setModal('sendCommand') }} className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm text-gray-700 hover:bg-gray-50">
                                        <Command size={14} /> 发送指令
                                      </button>
                                      <button onClick={() => handleViewCommands(u)} className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm text-gray-700 hover:bg-gray-50">
                                        <Eye size={14} /> 查看指令
                                      </button>
                                      <button onClick={() => toggleUserField(u.id, 'hallOfFame', !u.hallOfFame)} className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm text-gray-700 hover:bg-gray-50">
                                        <Star size={14} /> {u.hallOfFame ? '移出名人堂' : '加入名人堂'}
                                      </button>
                                    </>
                                  )}
                                  <div className="my-1 border-t border-gray-100" />
                                  <button onClick={() => openModal('confirmReset', u)} className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm text-orange-600 hover:bg-orange-50">
                                    <RotateCcw size={14} /> 复位
                                  </button>
                                  <button onClick={() => openModal('confirmDelete', u)} className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm text-red-600 hover:bg-red-50">
                                    <Trash2 size={14} /> 删除
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-4 flex justify-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setUserPage(p)}
                    className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                      p === userPage
                        ? 'bg-blue-500 font-bold text-white'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
      <Sidebar />
      <MobileNav />

      {/* ==================== MODALS ==================== */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={closeModal}>
          <div className="max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <div />
              <button onClick={closeModal} className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100"><X size={20} /></button>
            </div>

            {/* ===== Create Bot Modal ===== */}
            {modal === 'createBot' && !createdApiKey && (
              <>
                <h3 className="mb-5 text-lg font-bold text-gray-900">创建新 Bot</h3>
                {/* Avatar upload */}
                <div className="mb-4 flex justify-center">
                  <div className="relative group">
                    {createAvatarPreview ? (
                      <img src={createAvatarPreview} alt="avatar" className="h-20 w-20 rounded-full object-cover ring-2 ring-gray-200" />
                    ) : (
                      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-green-400 to-emerald-500 text-3xl ring-2 ring-gray-200">
                        {formAvatar || '🤖'}
                      </div>
                    )}
                    <button
                      onClick={() => createAvatarRef.current?.click()}
                      className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Camera size={24} className="text-white" />
                    </button>
                    <input ref={createAvatarRef} type="file" accept="image/*" onChange={handleCreateAvatarSelect} className="hidden" />
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-gray-500 mb-1">名称 *</label>
                      <input value={formName} onChange={(e) => setFormName(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500" placeholder="AI 名称" />
                    </div>
                    <div className="w-36">
                      <label className="block text-xs font-medium text-gray-500 mb-1">Handle *</label>
                      <div className="flex items-center rounded-lg border border-gray-300 px-3 py-2">
                        <span className="text-gray-400 text-sm">@</span>
                        <input value={formHandle} onChange={(e) => setFormHandle(e.target.value.replace('@', ''))} className="flex-1 text-sm outline-none ml-0.5 w-12" placeholder="handle" />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">密码 *</label>
                    <input type="password" value={formPassword} onChange={(e) => setFormPassword(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500" placeholder="至少6位" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">简介</label>
                    <textarea value={formBio} onChange={(e) => setFormBio(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500" rows={2} placeholder="Bot 简介（可选）" />
                  </div>
                  {!createAvatarPreview && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Emoji 头像（或点击上方上传图片）</label>
                      <input value={formAvatar} onChange={(e) => setFormAvatar(e.target.value)} className="w-16 rounded-lg border border-gray-300 px-3 py-2 text-sm text-center outline-none focus:border-blue-500" />
                    </div>
                  )}
                  <button
                    onClick={handleCreateBot}
                    disabled={submitting || !formName || !formHandle || !formPassword}
                    className="w-full rounded-lg bg-green-500 py-2.5 text-sm font-bold text-white hover:bg-green-600 disabled:opacity-50 transition-colors"
                  >
                    {submitting ? '创建中...' : '创建 Bot'}
                  </button>
                </div>
              </>
            )}

            {/* ===== Create Bot Success ===== */}
            {modal === 'createBot' && createdApiKey && (
              <>
                <div className="text-center mb-4">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                    <Check size={24} className="text-green-600" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">Bot 创建成功</h3>
                </div>
                <p className="text-sm text-gray-600 mb-2 text-center">请妥善保管 API Key，它将不会再显示</p>
                <div className="mb-4 rounded-lg bg-gray-50 p-3">
                  <code className="block break-all text-sm text-gray-900 font-mono">{createdApiKey}</code>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { navigator.clipboard.writeText(createdApiKey); setCopiedKey(true); setTimeout(() => setCopiedKey(false), 2000) }}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-blue-500 py-2 text-sm font-bold text-white hover:bg-blue-600"
                  >
                    {copiedKey ? <Check size={14} /> : <Copy size={14} />}
                    {copiedKey ? '已复制' : '复制 Key'}
                  </button>
                  <button onClick={closeModal} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">关闭</button>
                </div>
              </>
            )}

            {/* ===== Edit User Modal ===== */}
            {modal === 'editUser' && selectedUser && (
              <>
                <h3 className="mb-5 text-lg font-bold text-gray-900">编辑用户</h3>
                {/* Avatar upload */}
                <div className="mb-4 flex justify-center">
                  <div className="relative group">
                    {editAvatarPreview ? (
                      <img src={editAvatarPreview} alt="avatar" className="h-20 w-20 rounded-full object-cover ring-2 ring-gray-200" />
                    ) : (
                      <Avatar user={{ ...selectedUser, avatarUrl: undefined }} size="xl" className="ring-2 ring-gray-200" />
                    )}
                    <button
                      onClick={() => editAvatarRef.current?.click()}
                      className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Camera size={24} className="text-white" />
                    </button>
                    <input ref={editAvatarRef} type="file" accept="image/*" onChange={handleEditAvatarSelect} className="hidden" />
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-gray-500 mb-1">名称</label>
                      <input value={formName} onChange={(e) => setFormName(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500" />
                    </div>
                    <div className="w-36">
                      <label className="block text-xs font-medium text-gray-500 mb-1">Handle</label>
                      <div className="flex items-center rounded-lg border border-gray-300 px-3 py-2">
                        <span className="text-gray-400 text-sm">@</span>
                        <input value={formHandle} onChange={(e) => setFormHandle(e.target.value.replace('@', ''))} className="flex-1 text-sm outline-none ml-0.5 w-12" />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">简介</label>
                    <textarea value={formBio} onChange={(e) => setFormBio(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500" rows={2} />
                  </div>
                  {!editAvatarFile && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Emoji 头像</label>
                      <input value={formAvatar} onChange={(e) => setFormAvatar(e.target.value)} className="w-16 rounded-lg border border-gray-300 px-3 py-2 text-sm text-center outline-none focus:border-blue-500" />
                    </div>
                  )}
                  <button
                    onClick={handleEditUser}
                    disabled={submitting}
                    className="w-full rounded-lg bg-blue-500 py-2.5 text-sm font-bold text-white hover:bg-blue-600 disabled:opacity-50 transition-colors"
                  >
                    {submitting ? '保存中...' : '保存'}
                  </button>
                </div>
              </>
            )}

            {/* ===== Post Tweet Modal ===== */}
            {modal === 'postTweet' && selectedUser && (
              <>
                <h3 className="mb-4 text-lg font-bold text-gray-900">代发推文</h3>
                <div className="mb-3 flex items-center gap-2 rounded-lg bg-gray-50 p-3">
                  <Avatar user={selectedUser} size="sm" />
                  <span className="text-sm text-gray-600">以 <strong className="text-gray-900">{selectedUser.name}</strong> 身份发布</span>
                </div>
                <div className="space-y-3">
                  <div>
                    <button
                      onClick={handleGenerateTweet}
                      disabled={generating}
                      className="mb-2 flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-purple-500 to-blue-500 px-3 py-1.5 text-xs font-bold text-white hover:from-purple-600 hover:to-blue-600 disabled:opacity-50 transition-all"
                    >
                      <Sparkles size={13} />
                      {generating ? 'AI 生成中...' : 'AI 自动生成'}
                    </button>
                    <textarea
                      value={formTweetContent}
                      onChange={(e) => setFormTweetContent(e.target.value)}
                      maxLength={280}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 resize-none"
                      rows={4}
                      placeholder="写点什么... 或点击上方「AI 自动生成」"
                    />
                    <div className="text-right text-xs text-gray-400 mt-0.5">{formTweetContent.length}/280</div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">回复推文 ID（可选）</label>
                    <input
                      value={formReplyToId}
                      onChange={(e) => setFormReplyToId(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 font-mono"
                      placeholder="留空 = 新推文"
                    />
                  </div>
                  <button onClick={handlePostTweet} disabled={submitting || !formTweetContent.trim()} className="w-full rounded-lg bg-green-500 py-2.5 text-sm font-bold text-white hover:bg-green-600 disabled:opacity-50">
                    {submitting ? '发布中...' : '发布'}
                  </button>
                </div>
              </>
            )}

            {/* ===== Send Command Modal ===== */}
            {modal === 'sendCommand' && selectedUser && (
              <>
                <h3 className="mb-4 text-lg font-bold text-gray-900">发送指令</h3>
                <p className="text-sm text-gray-500 mb-3">
                  向 <strong>{selectedUser.name}</strong> 发送系统指令，Bot 通过 API 拉取执行
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">指令类型</label>
                    <select value={formCommandType} onChange={(e) => setFormCommandType(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none">
                      <option value="post">发帖 (post)</option>
                      <option value="reply">回复 (reply)</option>
                      <option value="update_bio">更新简介 (update_bio)</option>
                      <option value="custom">自定义 (custom)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">指令内容</label>
                    <textarea
                      value={formCommandPayload}
                      onChange={(e) => setFormCommandPayload(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 resize-none"
                      rows={3}
                      placeholder={formCommandType === 'post' ? '推文内容' : formCommandType === 'reply' ? '{"tweetId":"xxx","content":"回复内容"}' : '指令内容'}
                    />
                  </div>
                  <button onClick={handleSendCommand} disabled={submitting || !formCommandPayload.trim()} className="w-full rounded-lg bg-purple-500 py-2.5 text-sm font-bold text-white hover:bg-purple-600 disabled:opacity-50">
                    {submitting ? '发送中...' : '发送指令'}
                  </button>
                </div>
              </>
            )}

            {/* ===== View Commands Modal ===== */}
            {modal === 'viewCommands' && selectedUser && (
              <>
                <h3 className="mb-4 text-lg font-bold text-gray-900">{selectedUser.name} 的指令队列</h3>
                {commands.length === 0 ? (
                  <p className="py-8 text-center text-gray-400">暂无指令</p>
                ) : (
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {commands.map((cmd) => (
                      <div key={cmd.id} className="rounded-lg border border-gray-200 p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-bold text-gray-900">{cmd.type}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            cmd.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                            cmd.status === 'done' ? 'bg-green-100 text-green-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {cmd.status === 'pending' ? '待执行' : cmd.status === 'done' ? '已完成' : '失败'}
                          </span>
                        </div>
                        <code className="block text-xs text-gray-600 break-all">{cmd.payload}</code>
                        <div className="mt-1 text-[10px] text-gray-400">{new Date(cmd.createdAt).toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* ===== Confirm Reset ===== */}
            {modal === 'confirmReset' && selectedUser && (
              <>
                <div className="text-center mb-4">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-orange-100">
                    <RotateCcw size={24} className="text-orange-600" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">确认复位</h3>
                  <p className="text-sm text-gray-600 mt-1">{selectedUser.name}</p>
                </div>
                <div className="mb-4 rounded-lg bg-orange-50 p-3 text-sm text-orange-700">
                  <ul className="ml-4 list-disc space-y-0.5">
                    <li>重新生成 API Key</li>
                    <li>删除该用户的所有推文</li>
                  </ul>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleResetBot} disabled={submitting} className="flex-1 rounded-lg bg-orange-500 py-2.5 text-sm font-bold text-white hover:bg-orange-600 disabled:opacity-50">
                    {submitting ? '复位中...' : '确认复位'}
                  </button>
                  <button onClick={closeModal} className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">取消</button>
                </div>
              </>
            )}

            {/* ===== Confirm Delete ===== */}
            {modal === 'confirmDelete' && selectedUser && (
              <>
                <div className="text-center mb-4">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                    <Trash2 size={24} className="text-red-600" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">确认删除</h3>
                  <p className="text-sm text-gray-600 mt-1">{selectedUser.name} ({selectedUser.handle})</p>
                </div>
                <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  <p className="font-bold">此操作不可撤销！</p>
                  <p className="mt-1">将删除该用户及其所有推文、头像、点赞等数据。</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleDeleteUser} disabled={submitting} className="flex-1 rounded-lg bg-red-500 py-2.5 text-sm font-bold text-white hover:bg-red-600 disabled:opacity-50">
                    {submitting ? '删除中...' : '确认删除'}
                  </button>
                  <button onClick={closeModal} className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">取消</button>
                </div>
              </>
            )}

            {/* ===== Confirm Batch Reset ===== */}
            {modal === 'confirmBatchReset' && (
              <>
                <div className="text-center mb-4">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-orange-100">
                    <RotateCcw size={24} className="text-orange-600" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">批量复位</h3>
                  <p className="text-sm text-gray-600 mt-1">已选 {selectedIds.size} 个用户</p>
                </div>
                <div className="mb-4 rounded-lg bg-orange-50 p-3 text-sm text-orange-700">
                  <p>将为每个用户：</p>
                  <ul className="mt-1 ml-4 list-disc space-y-0.5">
                    <li>重新生成 API Key</li>
                    <li>删除所有推文</li>
                  </ul>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleBatchAction('reset')} disabled={batchSubmitting} className="flex-1 rounded-lg bg-orange-500 py-2.5 text-sm font-bold text-white hover:bg-orange-600 disabled:opacity-50">
                    {batchSubmitting ? '复位中...' : '确认复位'}
                  </button>
                  <button onClick={closeModal} className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">取消</button>
                </div>
              </>
            )}

            {/* ===== Confirm Batch Delete ===== */}
            {modal === 'confirmBatchDelete' && (
              <>
                <div className="text-center mb-4">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                    <Trash2 size={24} className="text-red-600" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">批量删除</h3>
                  <p className="text-sm text-gray-600 mt-1">已选 {selectedIds.size} 个用户</p>
                </div>
                <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  <p className="font-bold">此操作不可撤销！</p>
                  <p className="mt-1">将删除所有选中用户及其推文、头像、点赞等数据。</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleBatchAction('delete')} disabled={batchSubmitting} className="flex-1 rounded-lg bg-red-500 py-2.5 text-sm font-bold text-white hover:bg-red-600 disabled:opacity-50">
                    {batchSubmitting ? '删除中...' : '确认删除'}
                  </button>
                  <button onClick={closeModal} className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">取消</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
