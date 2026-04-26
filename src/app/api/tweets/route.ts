import { NextResponse } from 'next/server'
import { prisma, AUTHOR_SELECT } from '@/lib/db'
import { getSession } from '@/lib/session'
import { isPostContentVisible } from '@/lib/moderation'
import { uniqueTweetsByAuthorContent } from '@/lib/tweet-dedupe'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1)
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20') || 20))
    const skip = (page - 1) * limit

    const session = await getSession()
    const noCount = searchParams.get('nocount') === '1'

    const visibleIds = uniqueTweetsByAuthorContent((await prisma.tweet.findMany({
      where: { replyToId: null },
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
    const directReplies = pageIds.length === 0 ? [] : await prisma.tweet.findMany({
      where: { replyToId: { in: pageIds } },
      include: {
        author: {
          select: { ...AUTHOR_SELECT, createdAt: true },
        },
        replyTo: { select: { id: true, author: { select: { handle: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    })
    const directReplyParent = new Map(directReplies.map((reply) => [reply.id, reply.replyToId || '']))
    const childReplies = directReplies.length === 0 ? [] : await prisma.tweet.findMany({
      where: { replyToId: { in: directReplies.map((reply) => reply.id) } },
      include: {
        author: {
          select: { ...AUTHOR_SELECT, createdAt: true },
        },
        replyTo: { select: { id: true, author: { select: { handle: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    })
    type ReplyPreviewRow = (typeof directReplies)[number] & { previewDepth: number }
    const repliesByTweet = new Map<string, ReplyPreviewRow[]>()
    const pushPreview = (tweetId: string, reply: (typeof directReplies)[number], previewDepth: number) => {
      const group = repliesByTweet.get(tweetId) || []
      if (group.length < 2 && isPostContentVisible(reply.content)) {
        group.push({ ...reply, previewDepth })
        repliesByTweet.set(tweetId, group)
      }
    }
    for (const reply of directReplies.filter((reply) => isPostContentVisible(reply.content))) {
      pushPreview(reply.replyToId || '', reply, 0)
    }
    for (const reply of childReplies.filter((reply) => isPostContentVisible(reply.content))) {
      const rootId = directReplyParent.get(reply.replyToId || '')
      if (rootId) pushPreview(rootId, reply, 1)
    }

    const result = visibleTweets.map((t) => ({
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
      replyPreview: (repliesByTweet.get(t.id) || []).map((reply) => ({
        id: reply.id,
        content: reply.content,
        author: reply.author,
        createdAt: reply.createdAt.toISOString(),
        likesCount: reply.likesCount,
        retweetsCount: reply.retweetsCount,
        repliesCount: reply.repliesCount,
        viewsCount: reply.viewsCount,
        tipsCount: reply.tipsCount,
        replyToId: reply.replyToId,
        replyToHandle: reply.replyTo?.author?.handle || null,
        replyDepth: reply.previewDepth,
      })),
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
    })
  } catch (error) {
    console.error('Get tweets error:', error)
    return NextResponse.json({ error: '获取推文失败' }, { status: 500 })
  }
}
