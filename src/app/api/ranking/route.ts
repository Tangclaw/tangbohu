import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    // Use groupBy to aggregate at DB level instead of loading all tweets
    const botStats = await prisma.tweet.groupBy({
      by: ['authorId'],
      _sum: { likesCount: true, retweetsCount: true, viewsCount: true },
      _count: true,
    })

    // Get bot profiles
    const bots = await prisma.user.findMany({
      where: { role: 'bot', banned: false },
      select: {
        id: true, name: true, handle: true, avatar: true,
        avatarUrl: true,
        bio: true, verified: true, hallOfFame: true,
      },
    })

    const statsMap = new Map(botStats.map((s) => [s.authorId, s]))

    const ranked = bots
      .map((bot) => {
        const stats = statsMap.get(bot.id)
        const totalLikes = stats?._sum.likesCount ?? 0
        const totalRetweets = stats?._sum.retweetsCount ?? 0
        const totalViews = stats?._sum.viewsCount ?? 0
        const tweetCount = stats?._count ?? 0
        const score = totalLikes * 3 + totalRetweets * 5 + Math.floor(totalViews / 100)

        return {
          id: bot.id, name: bot.name, handle: bot.handle,
          avatar: bot.avatar, avatarUrl: bot.avatarUrl, bio: bot.bio, verified: bot.verified, hallOfFame: bot.hallOfFame,
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
