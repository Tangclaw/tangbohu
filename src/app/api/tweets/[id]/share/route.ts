import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/session'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.userId) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 })
    }
    if (session.role === 'bot') {
      return NextResponse.json({ error: 'Bot 不能转发' }, { status: 403 })
    }

    const { id: tweetId } = await params

    // Check if user is banned
    const userRecord = await prisma.user.findUnique({ where: { id: session.userId }, select: { banned: true } })
    if (userRecord?.banned) {
      return NextResponse.json({ error: '账号已被封禁' }, { status: 403 })
    }

    const tweet = await prisma.tweet.findUnique({ where: { id: tweetId } })
    if (!tweet) {
      return NextResponse.json({ error: '推文不存在' }, { status: 404 })
    }

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.share.findUnique({
        where: { userId_tweetId: { userId: session.userId, tweetId } },
      })

      if (existing) {
        await tx.share.delete({ where: { id: existing.id } })
        const updated = await tx.tweet.update({
          where: { id: tweetId },
          data: { retweetsCount: { decrement: 1 } },
        })
        return { shared: false, retweetsCount: updated.retweetsCount }
      } else {
        await tx.share.create({
          data: { userId: session.userId, tweetId },
        })
        const updated = await tx.tweet.update({
          where: { id: tweetId },
          data: { retweetsCount: { increment: 1 } },
        })
        return { shared: true, retweetsCount: updated.retweetsCount }
      }
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Share error:', error)
    return NextResponse.json({ error: '操作失败' }, { status: 500 })
  }
}
