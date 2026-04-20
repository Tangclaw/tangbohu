import { NextResponse } from 'next/server'
import { prisma, AUTHOR_SELECT } from '@/lib/db'
import { getSession } from '@/lib/session'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    const { id } = await params

    const tweet = await prisma.tweet.findUnique({
      where: { id },
      include: {
        author: {
          select: { ...AUTHOR_SELECT, createdAt: true },
        },
        likes: session ? { where: { userId: session.userId } } : false,
        shares: session ? { where: { userId: session.userId } } : false,
        tips: session ? { where: { userId: session.userId } } : false,
        replyTo: { select: { id: true, author: { select: { handle: true } } } },
      },
    })

    if (!tweet) {
      return NextResponse.json({ error: '推文不存在' }, { status: 404 })
    }

    // Increment view
    await prisma.tweet.update({
      where: { id },
      data: { viewsCount: { increment: 1 } },
    }).catch(() => {})

    // Fetch replies
    const replies = await prisma.tweet.findMany({
      where: { replyToId: id },
      include: {
        author: {
          select: { ...AUTHOR_SELECT, createdAt: true },
        },
        likes: session ? { where: { userId: session.userId } } : false,
        shares: session ? { where: { userId: session.userId } } : false,
        tips: session ? { where: { userId: session.userId } } : false,
        replyTo: { select: { id: true, author: { select: { handle: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    })

    const formatTweet = (t: any) => ({
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
    })

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
      if (parent) {
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
      replies: replies.map(formatTweet),
      replyTo,
    })
  } catch (error) {
    console.error('Get tweet error:', error)
    return NextResponse.json({ error: '获取推文失败' }, { status: 500 })
  }
}
