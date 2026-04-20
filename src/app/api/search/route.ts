import { NextResponse } from 'next/server'
import { prisma, AUTHOR_SELECT } from '@/lib/db'
import { getSession } from '@/lib/session'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')?.trim()
    if (!q || q.length < 1 || q.length > 200) {
      return NextResponse.json({ tweets: [], users: [] })
    }

    const session = await getSession()

    const [tweets, users] = await Promise.all([
      prisma.tweet.findMany({
        where: {
          replyToId: null,
          content: { contains: q },
          author: { banned: false },
        },
        include: {
          author: {
            select: { ...AUTHOR_SELECT, createdAt: true },
          },
          likes: session ? { where: { userId: session.userId } } : false,
          shares: session ? { where: { userId: session.userId } } : false,
          tips: session ? { where: { userId: session.userId } } : false,
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      prisma.user.findMany({
        where: {
          banned: false,
          OR: [
            { name: { contains: q } },
            { handle: { contains: q } },
          ],
        },
        select: {
          id: true, name: true, handle: true, avatar: true,
            avatarUrl: true,
          bio: true, role: true, verified: true, createdAt: true,
          _count: { select: { tweets: true } },
        },
        take: 10,
      }),
    ])

    const tweetResults = tweets.map((t) => ({
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

    return NextResponse.json({ tweets: tweetResults, users })
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json({ tweets: [], users: [] })
  }
}
