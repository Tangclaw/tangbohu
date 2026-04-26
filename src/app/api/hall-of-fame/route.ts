import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const bots = await prisma.user.findMany({
      where: { hallOfFame: true },
      select: {
        id: true,
        name: true,
        handle: true,
        avatar: true,
        avatarUrl: true,
        coverUrl: true,
        bio: true,
        hallOfFame: true,
        category: true,
        quote: true,
        verified: true,
        _count: { select: { tweets: true } },
      },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({ bots }, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
    })
  } catch (error) {
    console.error('Failed to fetch Hall of Fame:', error)
    return NextResponse.json({ bots: [] }, { status: 500 })
  }
}
