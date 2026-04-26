import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/session'
import { isPostContentVisible } from '@/lib/moderation'
import { uniqueTweetsByAuthorContent } from '@/lib/tweet-dedupe'
import { getReplyPreviewMap } from '@/lib/reply-preview'

function decodeHandleSegment(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ handle: string }> }
) {
  try {
    const { handle: rawHandle } = await params
    // Normalize: ensure handle starts with @
    const routeHandle = decodeHandleSegment(rawHandle)
    const handle = routeHandle.startsWith('@') ? routeHandle : `@${routeHandle}`

    const session = await getSession()

    const user = await prisma.user.findUnique({
      where: { handle },
      select: {
        id: true, name: true, handle: true, avatar: true,
        avatarUrl: true,
        coverUrl: true,
        bio: true, role: true, verified: true, createdAt: true,
        banned: true, hallOfFame: true, category: true, quote: true,
        _count: { select: { tweets: true, followers: true, following: true } },
      },
    })

    if (!user || user.banned) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1)
    const limit = 20
    const skip = (page - 1) * limit
    const isFollowing = session?.userId
      ? Boolean(await prisma.follow.findUnique({
        where: { userId_followingId: { userId: session.userId, followingId: user.id } },
      }))
      : false

    const allUserTweets = await prisma.tweet.findMany({
      where: { authorId: user.id, replyToId: null },
      select: {
        id: true,
        authorId: true,
        category: true,
        content: true,
        replyToId: true,
        likesCount: true,
        retweetsCount: true,
        viewsCount: true,
        tipsCount: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    const visibleStats = uniqueTweetsByAuthorContent(
      allUserTweets.filter((tweet) => isPostContentVisible(tweet.content))
    )
    const stats = visibleStats.reduce((sum, tweet) => {
      sum.totalLikes += tweet.likesCount
      sum.totalRetweets += tweet.retweetsCount
      sum.totalViews += tweet.viewsCount
      sum.totalTips += tweet.tipsCount
      return sum
    }, {
      totalLikes: 0,
      totalRetweets: 0,
      totalViews: 0,
      totalTips: 0,
    })
    const total = visibleStats.length

    const pageIds = visibleStats.slice(skip, skip + limit).map((tweet) => tweet.id)
    const tweets = pageIds.length === 0 ? [] : await prisma.tweet.findMany({
      where: { id: { in: pageIds } },
      include: {
        likes: session ? { where: { userId: session.userId } } : false,
        shares: session ? { where: { userId: session.userId } } : false,
        tips: session ? { where: { userId: session.userId } } : false,
        replyTo: { select: { id: true, author: { select: { handle: true } } } },
      },
    })

    const order = new Map(pageIds.map((id, index) => [id, index]))
    const visibleTweets = tweets.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
    const replyPreviewByTweet = await getReplyPreviewMap(pageIds)

    const result = visibleTweets.map((t) => ({
      id: t.id,
      content: t.content,
      category: t.category,
      topicId: t.topicId,
      author: {
        id: user.id, name: user.name, handle: user.handle,
        avatar: user.avatar, avatarUrl: user.avatarUrl, coverUrl: user.coverUrl, bio: user.bio, role: user.role,
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
      replyPreview: replyPreviewByTweet.get(t.id) || [],
    }))

    return NextResponse.json({
      user: {
        id: user.id, name: user.name, handle: user.handle,
        avatar: user.avatar, avatarUrl: user.avatarUrl, coverUrl: user.coverUrl, bio: user.bio, role: user.role,
        verified: user.verified, createdAt: user.createdAt.toISOString(),
        hallOfFame: user.hallOfFame, category: user.category, quote: user.quote,
        followersCount: user._count.followers,
        followingCount: user._count.following,
        isFollowing,
      tweetCount: total,
        totalLikes: stats.totalLikes,
        totalRetweets: stats.totalRetweets,
        totalViews: stats.totalViews,
        totalTips: stats.totalTips,
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
