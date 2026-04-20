import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/session'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ handle: string }> }
) {
  try {
    const { handle: rawHandle } = await params
    // Normalize: ensure handle starts with @
    const handle = rawHandle.startsWith('@') ? rawHandle : `@${rawHandle}`

    const session = await getSession()

    const user = await prisma.user.findUnique({
      where: { handle },
      select: {
        id: true, name: true, handle: true, avatar: true,
        avatarUrl: true,
        bio: true, role: true, verified: true, createdAt: true,
        banned: true, hallOfFame: true, category: true, quote: true,
        _count: { select: { tweets: true } },
      },
    })

    if (!user || user.banned) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1)
    const limit = 20
    const skip = (page - 1) * limit

    const [tweets, total] = await Promise.all([
      prisma.tweet.findMany({
        where: { authorId: user.id },
        include: {
          likes: session ? { where: { userId: session.userId } } : false,
          shares: session ? { where: { userId: session.userId } } : false,
          tips: session ? { where: { userId: session.userId } } : false,
          replyTo: { select: { id: true, author: { select: { handle: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.tweet.count({ where: { authorId: user.id } }),
    ])

    const stats = await prisma.tweet.aggregate({
      where: { authorId: user.id },
      _sum: { likesCount: true, retweetsCount: true, viewsCount: true, tipsCount: true },
    })

    const result = tweets.map((t) => ({
      id: t.id,
      content: t.content,
      author: {
        id: user.id, name: user.name, handle: user.handle,
        avatar: user.avatar, avatarUrl: user.avatarUrl, bio: user.bio, role: user.role,
        verified: user.verified, createdAt: user.createdAt.toISOString(),
        hallOfFame: user.hallOfFame, category: user.category, quote: user.quote,
      },
      createdAt: t.createdAt.toISOString(),
      likesCount: t.likesCount,
      retweetsCount: t.retweetsCount,
      repliesCount: t.repliesCount,
      viewsCount: t.viewsCount,
      tipsCount: t.tipsCount,
      liked: session ? t.likes.length > 0 : false,
      shared: session ? t.shares.length > 0 : false,
      tipped: session ? t.tips.length > 0 : false,
      replyToId: t.replyToId,
      replyToHandle: t.replyTo?.author?.handle || null,
    }))

    return NextResponse.json({
      user: {
        id: user.id, name: user.name, handle: user.handle,
        avatar: user.avatar, avatarUrl: user.avatarUrl, bio: user.bio, role: user.role,
        verified: user.verified, createdAt: user.createdAt.toISOString(),
        hallOfFame: user.hallOfFame, category: user.category, quote: user.quote,
        tweetCount: user._count.tweets,
        totalLikes: stats._sum.likesCount ?? 0,
        totalRetweets: stats._sum.retweetsCount ?? 0,
        totalViews: stats._sum.viewsCount ?? 0,
        totalTips: stats._sum.tipsCount ?? 0,
      },
      tweets: result,
      page,
      totalPages: Math.ceil(total / limit),
      total,
    })
  } catch (error) {
    console.error('Get user error:', error)
    return NextResponse.json({ error: '获取用户信息失败' }, { status: 500 })
  }
}
