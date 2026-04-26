import { NextResponse } from 'next/server'
import { prisma, AUTHOR_SELECT } from '@/lib/db'
import { getSession } from '@/lib/session'
import { isPostContentVisible } from '@/lib/moderation'
import { uniqueTweetsByAuthorContent } from '@/lib/tweet-dedupe'
import { getReplyPreviewMap } from '@/lib/reply-preview'
import { sanitizeTweetCategory } from '@/lib/tweet-category'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1)
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20') || 20))
    const skip = (page - 1) * limit

    const session = await getSession()
    const noCount = searchParams.get('nocount') === '1'
    const categoryRaw = searchParams.get('category')?.trim()
    const category = categoryRaw ? sanitizeTweetCategory(categoryRaw) : ''
    const topicId = searchParams.get('topicId')?.trim() || ''
    const feed = searchParams.get('feed') === 'following' ? 'following' : 'all'

    let followingAuthorIds: string[] | null = null
    if (feed === 'following') {
      if (!session?.userId) {
        return NextResponse.json({ tweets: [], page, totalPages: 0, total: 0, feed, reason: 'login_required' })
      }
      const follows = await prisma.follow.findMany({
        where: { userId: session.userId },
        select: { followingId: true },
      })
      followingAuthorIds = follows.map((item) => item.followingId)
      if (followingAuthorIds.length === 0) {
        return NextResponse.json({ tweets: [], page, totalPages: 0, total: 0, feed, reason: 'empty_following' })
      }
    }

    const visibleIds = uniqueTweetsByAuthorContent((await prisma.tweet.findMany({
      where: {
        replyToId: null,
        ...(topicId ? { topicId } : {}),
        ...(category ? { category } : {}),
        ...(followingAuthorIds ? { authorId: { in: followingAuthorIds } } : {}),
        author: { banned: false },
      },
      select: { id: true, authorId: true, replyToId: true, content: true },
      orderBy: { createdAt: 'desc' },
    }))
      .filter((tweet) => isPostContentVisible(tweet.content)))
      .map((tweet) => tweet.id)

    const pageIds = visibleIds.slice(skip, skip + limit)
    const tweets = pageIds.length === 0 ? [] : await prisma.tweet.findMany({
      where: { id: { in: pageIds } },
      include: {
        author: {
          select: { ...AUTHOR_SELECT, createdAt: true },
        },
        likes: session ? { where: { userId: session.userId } } : false,
        shares: session ? { where: { userId: session.userId } } : false,
        tips: session ? { where: { userId: session.userId } } : false,
      },
    })

    const order = new Map(pageIds.map((id, index) => [id, index]))
    const visibleTweets = tweets.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
    const total = visibleIds.length
    const replyPreviewByTweet = await getReplyPreviewMap(pageIds)

    const result = visibleTweets.map((t) => ({
      id: t.id,
      content: t.content,
      category: t.category,
      topicId: t.topicId,
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
      replyPreview: replyPreviewByTweet.get(t.id) || [],
    }))

    // Increment views only on initial page load (not polling)
    if (!noCount) {
      prisma.tweet.updateMany({
        where: { id: { in: visibleTweets.map((t) => t.id) } },
        data: { viewsCount: { increment: 1 } },
      }).catch(() => {})
    }

    return NextResponse.json({
      tweets: result,
      page,
      totalPages: Math.ceil(total / limit),
      total,
      feed,
    })
  } catch (error) {
    console.error('Get tweets error:', error)
    return NextResponse.json({ error: '获取推文失败' }, { status: 500 })
  }
}
