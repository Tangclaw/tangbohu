import { NextResponse } from 'next/server'
import { prisma, AUTHOR_SELECT } from '@/lib/db'
import { getSession } from '@/lib/session'
import { isPostContentVisible } from '@/lib/moderation'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    const { id } = await params
    const tweetInclude = {
      author: {
        select: { ...AUTHOR_SELECT, createdAt: true },
      },
      likes: session ? { where: { userId: session.userId } } : false,
      shares: session ? { where: { userId: session.userId } } : false,
      tips: session ? { where: { userId: session.userId } } : false,
      replyTo: { select: { id: true, author: { select: { handle: true } } } },
    }

    const tweet = await prisma.tweet.findUnique({
      where: { id },
      include: tweetInclude,
    })

    if (!tweet || !isPostContentVisible(tweet.content)) {
      return NextResponse.json({ error: '推文不存在' }, { status: 404 })
    }

    // Increment view
    await prisma.tweet.update({
      where: { id },
      data: { viewsCount: { increment: 1 } },
    }).catch(() => {})

    const fetchReplyBatch = (parentIds: string[]) => prisma.tweet.findMany({
      where: { replyToId: { in: parentIds } },
      include: tweetInclude,
      orderBy: { createdAt: 'asc' },
    })
    type ReplyRow = Awaited<ReturnType<typeof fetchReplyBatch>>[number]
    type ThreadReplyRow = ReplyRow & { replyDepth: number }

    const formatTweet = (t: NonNullable<typeof tweet> | ThreadReplyRow) => ({
      id: t.id,
      content: t.content,
      author: t.author,
      createdAt: t.createdAt.toISOString(),
      likesCount: t.likesCount,
      retweetsCount: t.retweetsCount,
      repliesCount: t.repliesCount,
      viewsCount: t.viewsCount,
      tipsCount: t.tipsCount,
      liked: session ? t.likes?.length > 0 : false,
      shared: session ? t.shares?.length > 0 : false,
      tipped: session ? t.tips?.length > 0 : false,
      replyToId: t.replyToId,
      replyToHandle: t.replyTo?.author?.handle || null,
      replyDepth: 'replyDepth' in t ? t.replyDepth : 0,
    })

    const repliesByParent = new Map<string, ThreadReplyRow[]>()
    let frontier = [id]
    const maxDepth = 6
    for (let depth = 0; depth < maxDepth && frontier.length > 0; depth += 1) {
      const batch = await fetchReplyBatch(frontier)
      const visibleBatch = batch.filter((reply) => isPostContentVisible(reply.content))
      for (const reply of visibleBatch) {
        const parentId = reply.replyToId || id
        const repliesForParent = repliesByParent.get(parentId) || []
        repliesForParent.push({ ...reply, replyDepth: depth })
        repliesByParent.set(parentId, repliesForParent)
      }
      frontier = visibleBatch.map((reply) => reply.id)
    }

    const threadedReplies: ThreadReplyRow[] = []
    const seenReplyIds = new Set<string>()
    const appendReplies = (parentId: string) => {
      const children = repliesByParent.get(parentId) || []
      for (const child of children) {
        if (seenReplyIds.has(child.id)) continue
        seenReplyIds.add(child.id)
        threadedReplies.push(child)
        appendReplies(child.id)
      }
    }
    appendReplies(id)

    // If this is a reply, also fetch the parent tweet
    let replyTo = null
    if (tweet.replyToId) {
      const parent = await prisma.tweet.findUnique({
        where: { id: tweet.replyToId },
        include: {
          author: {
            select: { ...AUTHOR_SELECT, createdAt: true },
          },
        },
      })
      if (parent && isPostContentVisible(parent.content)) {
        replyTo = {
          id: parent.id,
          content: parent.content,
          author: parent.author,
          createdAt: parent.createdAt.toISOString(),
          likesCount: parent.likesCount,
          retweetsCount: parent.retweetsCount,
          repliesCount: parent.repliesCount,
          viewsCount: parent.viewsCount,
          tipsCount: parent.tipsCount,
        }
      }
    }

    const result = {
      ...formatTweet(tweet),
      viewsCount: tweet.viewsCount + 1,
    }

    return NextResponse.json({
      tweet: result,
      replies: threadedReplies.map(formatTweet),
      replyTo,
    })
  } catch (error) {
    console.error('Get tweet error:', error)
    return NextResponse.json({ error: '获取推文失败' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: '无权限' }, { status: 403 })
    }

    const { id } = await params

    const tweet = await prisma.tweet.findUnique({ where: { id } })
    if (!tweet) {
      return NextResponse.json({ error: '推文不存在' }, { status: 404 })
    }

    const operations = [
      prisma.like.deleteMany({ where: { tweetId: id } }),
      prisma.share.deleteMany({ where: { tweetId: id } }),
      prisma.tip.deleteMany({ where: { tweetId: id } }),
      prisma.tweet.deleteMany({ where: { replyToId: id } }),
      prisma.tweet.delete({ where: { id } }),
    ]

    if (tweet.replyToId) {
      operations.unshift(
        prisma.tweet.updateMany({
          where: { id: tweet.replyToId, repliesCount: { gt: 0 } },
          data: { repliesCount: { decrement: 1 } },
        })
      )
    }

    await prisma.$transaction(operations)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete tweet error:', error)
    return NextResponse.json({ error: '删除失败' }, { status: 500 })
  }
}
