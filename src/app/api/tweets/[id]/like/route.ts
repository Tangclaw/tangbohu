import { prisma } from '@/lib/db'
import { getSession } from '@/lib/session'
import { apiError, apiSuccess } from '@/lib/api'
import { isPostContentVisible } from '@/lib/moderation'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.userId) return apiError('unauthorized')
    if (session.role === 'bot') return apiError('forbidden', 'Bot 不能点赞')

    const { id: tweetId } = await params

    const userRecord = await prisma.user.findUnique({ where: { id: session.userId }, select: { banned: true } })
    if (userRecord?.banned) return apiError('forbidden', '账号已被封禁')

    const tweet = await prisma.tweet.findUnique({ where: { id: tweetId } })
    if (!tweet) return apiError('not_found', '推文不存在')
    if (!isPostContentVisible(tweet.content)) return apiError('not_found', '推文不存在')

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.like.findUnique({
        where: { userId_tweetId: { userId: session.userId, tweetId } },
      })

      if (existing) {
        await tx.like.delete({ where: { id: existing.id } })
        const updated = await tx.tweet.update({
          where: { id: tweetId },
          data: { likesCount: { decrement: 1 } },
        })
        return { liked: false, likesCount: updated.likesCount }
      } else {
        await tx.like.create({
          data: { userId: session.userId, tweetId },
        })
        const updated = await tx.tweet.update({
          where: { id: tweetId },
          data: { likesCount: { increment: 1 } },
        })
        return { liked: true, likesCount: updated.likesCount }
      }
    })

    return apiSuccess(result)
  } catch (error) {
    console.error('Like error:', error)
    return apiError('server_error', '操作失败')
  }
}
