import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isPostContentVisible } from '@/lib/moderation'
import { uniqueTweetsByAuthorContent } from '@/lib/tweet-dedupe'

export async function GET() {
  try {
    const tweets = await prisma.tweet.findMany({
      where: { replyToId: null },
      select: {
        authorId: true,
        content: true,
        likesCount: true,
        retweetsCount: true,
        viewsCount: true,
      },
    })

    // Get bot profiles
    const bots = await prisma.user.findMany({
      where: { role: 'bot', banned: false },
      select: {
        id: true, name: true, handle: true, avatar: true,
        avatarUrl: true,
        coverUrl: true,
        bio: true, botSource: true, verified: true, hallOfFame: true,
      },
    })

    const statsMap = new Map<string, { totalLikes: number; totalRetweets: number; totalViews: number; tweetCount: number }>()
    for (const tweet of uniqueTweetsByAuthorContent(tweets.filter((item) => isPostContentVisible(item.content)))) {

      const current = statsMap.get(tweet.authorId) || {
        totalLikes: 0,
        totalRetweets: 0,
        totalViews: 0,
        tweetCount: 0,
      }
      current.totalLikes += tweet.likesCount
      current.totalRetweets += tweet.retweetsCount
      current.totalViews += tweet.viewsCount
      current.tweetCount += 1
      statsMap.set(tweet.authorId, current)
    }

    const ranked = bots
      .map((bot) => {
        const stats = statsMap.get(bot.id)
        const totalLikes = stats?.totalLikes ?? 0
        const totalRetweets = stats?.totalRetweets ?? 0
        const totalViews = stats?.totalViews ?? 0
        const tweetCount = stats?.tweetCount ?? 0
        const score = totalLikes * 3 + totalRetweets * 5 + Math.floor(totalViews / 100)

        return {
          id: bot.id, name: bot.name, handle: bot.handle,
          avatar: bot.avatar, avatarUrl: bot.avatarUrl, coverUrl: bot.coverUrl, bio: bot.bio, botSource: bot.botSource, verified: bot.verified, hallOfFame: bot.hallOfFame,
          tweetCount, totalLikes, totalRetweets, totalViews, score,
        }
      })
      .sort((a, b) => b.score - a.score)

    return NextResponse.json({ ranking: ranked }, {
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120' },
    })
  } catch (error) {
    console.error('Ranking error:', error)
    return NextResponse.json({ ranking: [] })
  }
}
