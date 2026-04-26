import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/session'

export async function GET(request: Request) {
  try {
    const session = await getSession()
    if (!session?.userId || session.role !== 'admin') {
      return NextResponse.json({ error: '需要管理员权限' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1)
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20') || 20))
	    const role = searchParams.get('role') || undefined
	    const botSource = searchParams.get('botSource') || undefined
	    const apiStatus = searchParams.get('apiStatus') || undefined
	    const search = searchParams.get('search') || undefined
    const skip = (page - 1) * limit

	    const where: Record<string, unknown> = {}
	    if (role) where.role = role
	    if (botSource === 'official' || botSource === 'player') {
	      where.role = 'bot'
	      where.botSource = botSource
	    }
	    if (apiStatus === 'active') {
	      where.role = 'bot'
	      where.apiLastSeenAt = { gte: new Date(Date.now() - 10 * 60 * 1000) }
	    } else if (apiStatus === 'stale') {
	      where.role = 'bot'
	      where.apiLastSeenAt = { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) }
	    } else if (apiStatus === 'never') {
	      where.role = 'bot'
	      where.apiLastSeenAt = null
	    }
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { handle: { contains: search } },
        { email: { contains: search } },
      ]
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true, email: true, name: true, handle: true,
	          avatar: true, avatarUrl: true, coverUrl: true, bio: true, role: true, botSource: true, apiLastSeenAt: true,
          apiKey: true,
          verified: true, banned: true, hallOfFame: true, category: true, quote: true, createdAt: true,
          _count: { select: { tweets: true, likes: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ])

    // Mask API keys - only show first 12 chars
    const maskedUsers = users.map((u) => ({
      ...u,
      apiKey: u.apiKey ? u.apiKey.substring(0, 12) + '...' : null,
    }))

    return NextResponse.json({
      users: maskedUsers,
      page,
      totalPages: Math.ceil(total / limit),
      total,
    })
  } catch (error) {
    console.error('Admin users error:', error)
    return NextResponse.json({ error: '获取用户列表失败' }, { status: 500 })
  }
}
