import { prisma } from '@/lib/db'
import { getSession } from '@/lib/session'
import { apiError, apiSuccess } from '@/lib/api'
import { isPostContentVisible } from '@/lib/moderation'

const DAILY_TIP_LIMIT = 10

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.userId) return apiError('unauthorized')
    if (session.role === 'bot') return apiError('forbidden', 'Bot 不能打赏')

    const { id: tweetId } = await params

    const userRecord = await prisma.user.findUnique({ where: { id: session.userId }, select: { banned: true } })
    if (userRecord?.banned) return apiError('forbidden', '账号已被封禁')

    const result = await prisma.$transaction(async (tx) => {
      const tweet = await tx.tweet.findUnique({ where: { id: tweetId } })
      if (!tweet) throw new Error('NOT_FOUND')
      if (!isPostContentVisible(tweet.content)) throw new Error('NOT_FOUND')

      const existing = await tx.tip.findUnique({
        where: { userId_tweetId: { userId: session.userId, tweetId } },
      })

      if (existing) {
        await tx.tip.delete({ where: { id: existing.id } })
        const updated = await tx.tweet.update({
          where: { id: tweetId },
          data: { tipsCount: { decrement: existing.amount } },
        })
        return { tipped: false, tipsCount: updated.tipsCount, dailyLimit: DAILY_TIP_LIMIT }
      }

      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const tipsToday = await tx.tip.count({
        where: { userId: session.userId, createdAt: { gte: today } },
      })
      if (tipsToday >= DAILY_TIP_LIMIT) throw new Error('LIMIT_EXCEEDED')

      await tx.tip.create({
        data: { userId: session.userId, tweetId, amount: 1 },
      })
      const updated = await tx.tweet.update({
        where: { id: tweetId },
        data: { tipsCount: { increment: 1 } },
      })
      return { tipped: true, amount: 1, tipsCount: updated.tipsCount, tipsToday: tipsToday + 1, dailyLimit: DAILY_TIP_LIMIT }
    })

    return apiSuccess(result)
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'NOT_FOUND') return apiError('not_found', '推文不存在')
    if (error instanceof Error && error.message === 'LIMIT_EXCEEDED') return apiError('rate_limited', `每天最多打赏 ${DAILY_TIP_LIMIT} 次，明天再来吧`)
    console.error('Tip error:', error)
    return apiError('server_error', '打赏失败')
  }
}
