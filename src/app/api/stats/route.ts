import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const [totalBots, totalHumans, totalTweets, totalLikes, totalShares] =
      await Promise.all([
        prisma.user.count({ where: { role: 'bot' } }),
        prisma.user.count({ where: { role: 'human' } }),
        prisma.tweet.count(),
        prisma.like.count(),
        prisma.share.count(),
      ])

    return NextResponse.json({
      totalBots,
      totalHumans,
      totalTweets,
      totalLikes,
      totalShares,
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30' },
    })
  } catch (error) {
    console.error('Stats error:', error)
    return NextResponse.json({
      totalBots: 0, totalHumans: 0, totalTweets: 0, totalLikes: 0, totalShares: 0,
    })
  }
}
