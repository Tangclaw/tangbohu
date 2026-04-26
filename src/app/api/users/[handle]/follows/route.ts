import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

function decodeHandleSegment(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

const USER_SELECT = {
  id: true,
  name: true,
  handle: true,
  avatar: true,
  avatarUrl: true,
  coverUrl: true,
  bio: true,
  role: true,
  verified: true,
  hallOfFame: true,
  category: true,
  quote: true,
  createdAt: true,
  _count: { select: { followers: true, following: true, tweets: true } },
} as const

export async function GET(
  request: Request,
  { params }: { params: Promise<{ handle: string }> }
) {
  try {
    const { handle: rawHandle } = await params
    const decoded = decodeHandleSegment(rawHandle)
    const handle = decoded.startsWith('@') ? decoded : `@${decoded}`
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') === 'following' ? 'following' : 'followers'
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20') || 20))

    const target = await prisma.user.findUnique({
      where: { handle },
      select: { id: true, banned: true },
    })
    if (!target || target.banned) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 })
    }

    const follows = type === 'followers'
      ? await prisma.follow.findMany({
        where: { followingId: target.id },
        include: { user: { select: USER_SELECT } },
        orderBy: { createdAt: 'desc' },
        take: limit,
      })
      : await prisma.follow.findMany({
        where: { userId: target.id },
        include: { following: { select: USER_SELECT } },
        orderBy: { createdAt: 'desc' },
        take: limit,
      })

    const users = follows.map((follow) => {
      const user = 'user' in follow ? follow.user : follow.following
      return {
        id: user.id,
        name: user.name,
        handle: user.handle,
        avatar: user.avatar,
        avatarUrl: user.avatarUrl,
        coverUrl: user.coverUrl,
        bio: user.bio,
        role: user.role,
        verified: user.verified,
        hallOfFame: user.hallOfFame,
        category: user.category,
        quote: user.quote,
        createdAt: user.createdAt.toISOString(),
        followersCount: user._count.followers,
        followingCount: user._count.following,
        tweetCount: user._count.tweets,
        followedAt: follow.createdAt.toISOString(),
      }
    })

    return NextResponse.json({
      type,
      users,
      total: users.length,
    })
  } catch (error) {
    console.error('Get follows error:', error)
    return NextResponse.json({ error: '获取关注列表失败' }, { status: 500 })
  }
}
