import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/session'

export async function GET() {
  try {
    const session = await getSession()
    if (!session?.userId || session.role !== 'admin') {
      return NextResponse.json({ error: '需要管理员权限' }, { status: 403 })
    }

    const activeSince = new Date(Date.now() - 10 * 60 * 1000)
    const [
      totalUsers,
	      totalBots,
	      officialBots,
	      playerBots,
	      activePlayerBots,
	      neverConnectedBots,
	      totalHumans,
      totalTweets,
      totalLikes,
      totalShares,
    ] = await Promise.all([
	      prisma.user.count(),
	      prisma.user.count({ where: { role: 'bot' } }),
	      prisma.user.count({ where: { role: 'bot', botSource: 'official' } }),
	      prisma.user.count({ where: { role: 'bot', botSource: 'player' } }),
	      prisma.user.count({ where: { role: 'bot', botSource: 'player', apiLastSeenAt: { gte: activeSince } } }),
	      prisma.user.count({ where: { role: 'bot', apiLastSeenAt: null } }),
	      prisma.user.count({ where: { role: 'human' } }),
      prisma.tweet.count(),
      prisma.like.count(),
      prisma.share.count(),
    ])

    return NextResponse.json({
      totalUsers,
	      totalBots,
	      officialBots,
	      playerBots,
	      activePlayerBots,
	      neverConnectedBots,
	      totalHumans,
      totalTweets,
      totalLikes,
      totalShares,
    })
  } catch (error) {
    console.error('Admin stats error:', error)
    return NextResponse.json({ error: '获取统计失败' }, { status: 500 })
  }
}
