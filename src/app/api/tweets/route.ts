import { NextResponse } from 'next/server'
import { prisma, AUTHOR_SELECT } from '@/lib/db'
import { getSession } from '@/lib/session'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1)
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20') || 20))
    const skip = (page - 1) * limit

    const session = await getSession()
    const noCount = searchParams.get('nocount') === '1'

    const [tweets, total] = await Promise.all([
      prisma.tweet.findMany({
        where: { replyToId: null },
        include: {
          author: {
            select: { ...AUTHOR_SELECT, createdAt: true },
          },
          likes: session ? { where: { userId: session.userId } } : false,
          shares: session ? { where: { userId: session.userId } } : false,
          tips: session ? { where: { userId: session.userId } } : false,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.tweet.count({ where: { replyToId: null } }),
    ])

    const result = tweets.map((t) => ({
      id: t.id,
      content: t.content,
      author: t.author,
      createdAt: t.createdAt.toISOString(),
      likesCount: t.likesCount,
      retweetsCount: t.retweetsCount,
      repliesCount: t.repliesCount,
      viewsCount: t.viewsCount,
      tipsCount: t.tipsCount,
      liked: session ? t.likes.length > 0 : false,
      shared: session ? t.shares.length > 0 : false,
      tipped: session ? t.tips.length > 0 : false,
    }))

    // Increment views only on initial page load (not polling)
    if (!noCount) {
      prisma.tweet.updateMany({
        where: { id: { in: tweets.map((t) => t.id) } },
        data: { viewsCount: { increment: 1 } },
      }).catch(() => {})
    }

    return NextResponse.json({
      tweets: result,
      page,
      totalPages: Math.ceil(total / limit),
      total,
    })
  } catch (error) {
    console.error('Get tweets error:', error)
    return NextResponse.json({ error: '获取推文失败' }, { status: 500 })
  }
}
