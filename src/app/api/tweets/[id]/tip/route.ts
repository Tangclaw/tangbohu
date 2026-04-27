import { prisma } from '@/lib/db'
import { getSession } from '@/lib/session'
import { apiError, apiSuccess } from '@/lib/api'
import { isPostContentVisible } from '@/lib/moderation'

const TIP_AMOUNT = 1

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.userId) return apiError('unauthorized')
    if (session.role === 'bot') return apiError('forbidden', 'Bot 不能打赏')

    const { id: tweetId } = await params

    const userRecord = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { banned: true, role: true, coinBalance: true },
    })
    if (userRecord?.banned) return apiError('forbidden', '账号已被封禁')
    if (userRecord?.role === 'bot') return apiError('forbidden', 'Bot 不能打赏')

    const result = await prisma.$transaction(async (tx) => {
      const tweet = await tx.tweet.findUnique({ where: { id: tweetId } })
      if (!tweet) throw new Error('NOT_FOUND')
      if (!isPostContentVisible(tweet.content)) throw new Error('NOT_FOUND')

      const existing = await tx.tip.findUnique({
        where: { userId_tweetId: { userId: session.userId, tweetId } },
      })

      if (existing) {
        return {
          tipped: true,
          amount: existing.amount,
          tipsCount: tweet.tipsCount,
          coinBalance: userRecord?.coinBalance ?? 0,
          alreadyTipped: true,
        }
      }

      const wallet = await tx.user.findUnique({
        where: { id: session.userId },
        select: { coinBalance: true },
      })
      if (!wallet || wallet.coinBalance < TIP_AMOUNT) throw new Error('INSUFFICIENT_COINS')

      await tx.tip.create({
        data: { userId: session.userId, tweetId, amount: TIP_AMOUNT },
      })
      const nextWallet = await tx.user.update({
        where: { id: session.userId },
        data: { coinBalance: { decrement: TIP_AMOUNT } },
        select: { coinBalance: true },
      })
      const updated = await tx.tweet.update({
        where: { id: tweetId },
        data: { tipsCount: { increment: TIP_AMOUNT } },
      })
      return { tipped: true, amount: TIP_AMOUNT, tipsCount: updated.tipsCount, coinBalance: nextWallet.coinBalance }
    })

    return apiSuccess(result)
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'NOT_FOUND') return apiError('not_found', '推文不存在')
    if (error instanceof Error && error.message === 'INSUFFICIENT_COINS') return apiError('forbidden', '算力币不足。算力币只能通过每日签到获得')
    console.error('Tip error:', error)
    return apiError('server_error', '打赏失败')
  }
}
