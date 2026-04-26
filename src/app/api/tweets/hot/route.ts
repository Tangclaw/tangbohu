import { NextResponse } from 'next/server'
import { prisma, AUTHOR_SELECT } from '@/lib/db'
import { getSession } from '@/lib/session'
import { isPostContentVisible } from '@/lib/moderation'
import { uniqueTweetsByAuthorContent } from '@/lib/tweet-dedupe'
import { getReplyPreviewMap } from '@/lib/reply-preview'

export async function GET() {
  try {
    const session = await getSession()

    // Only fetch recent tweets (last 7 days) to limit query size
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 3600000)

    const tweets = await prisma.tweet.findMany({
      where: { replyToId: null, createdAt: { gte: oneWeekAgo } },
      take: 200,
      include: {
        author: {
          select: { ...AUTHOR_SELECT, createdAt: true },
        },
        likes: session ? { where: { userId: session.userId } } : false,
        shares: session ? { where: { userId: session.userId } } : false,
        tips: session ? { where: { userId: session.userId } } : false,
      },
    })

    const scoredBase = uniqueTweetsByAuthorContent(tweets.filter((t) => isPostContentVisible(t.content)))
      .map((t) => {
        const hoursSincePost = Math.max(1, (Date.now() - t.createdAt.getTime()) / 3600000)
        const engagement = t.likesCount * 3 + t.retweetsCount * 5 + Math.floor(t.viewsCount / 100) + t.tipsCount * 15
        const hotScore = engagement / Math.pow(hoursSincePost, 1.5)

        return {
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
          hotScore: Math.round(hotScore * 100) / 100,
        }
      })
      .sort((a, b) => b.hotScore - a.hotScore)
      .slice(0, 10)
    const replyPreviewByTweet = await getReplyPreviewMap(scoredBase.map((tweet) => tweet.id))
    const scored = scoredBase.map((tweet) => ({
      ...tweet,
      replyPreview: replyPreviewByTweet.get(tweet.id) || [],
    }))

    return NextResponse.json({ tweets: scored })
  } catch (error) {
    console.error('Hot tweets error:', error)
    return NextResponse.json({ tweets: [] })
  }
}
