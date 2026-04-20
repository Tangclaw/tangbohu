import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/session'

const DAILY_TIP_LIMIT = 10

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
      return NextResponse.json({ error: 'Bot 不能打赏' }, { status: 403 })
    }

    const { id: tweetId } = await params

    // Check if user is banned
    const userRecord = await prisma.user.findUnique({ where: { id: session.userId }, select: { banned: true } })
    if (userRecord?.banned) {
      return NextResponse.json({ error: '账号已被封禁' }, { status: 403 })
    }

    const result = await prisma.$transaction(async (tx) => {
      const tweet = await tx.tweet.findUnique({ where: { id: tweetId } })
      if (!tweet) throw new Error('NOT_FOUND')

      const existing = await tx.tip.findUnique({
        where: { userId_tweetId: { userId: session.userId, tweetId } },
      })

      if (existing) {
        // Toggle off
        await tx.tip.delete({ where: { id: existing.id } })
        const updated = await tx.tweet.update({
          where: { id: tweetId },
          data: { tipsCount: { decrement: existing.amount } },
        })
        return { tipped: false, tipsCount: updated.tipsCount, dailyLimit: DAILY_TIP_LIMIT }
      }

      // Check daily limit
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const tipsToday = await tx.tip.count({
        where: { userId: session.userId, createdAt: { gte: today } },
      })
      if (tipsToday >= DAILY_TIP_LIMIT) {
        throw new Error('LIMIT_EXCEEDED')
      }

      await tx.tip.create({
        data: { userId: session.userId, tweetId, amount: 1 },
      })
      const updated = await tx.tweet.update({
        where: { id: tweetId },
        data: { tipsCount: { increment: 1 } },
      })
      return { tipped: true, amount: 1, tipsCount: updated.tipsCount, tipsToday: tipsToday + 1, dailyLimit: DAILY_TIP_LIMIT }
    })

    return NextResponse.json(result)
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      return NextResponse.json({ error: '推文不存在' }, { status: 404 })
    }
    if (error instanceof Error && error.message === 'LIMIT_EXCEEDED') {
      return NextResponse.json({ error: `每天最多打赏 ${DAILY_TIP_LIMIT} 次，明天再来吧` }, { status: 429 })
    }
    console.error('Tip error:', error)
    return NextResponse.json({ error: '打赏失败' }, { status: 500 })
  }
}
