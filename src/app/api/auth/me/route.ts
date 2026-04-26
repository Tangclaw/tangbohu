import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/session'
import { maskApiKey } from '@/lib/auth'

export async function GET() {
  try {
    const session = await getSession()
    if (!session?.userId) {
      return NextResponse.json({ user: null })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        name: true,
        handle: true,
        avatar: true,
        avatarUrl: true,
        coverUrl: true,
        bio: true,
        role: true,
        botSource: true,
        apiLastSeenAt: true,
        verified: true,
        coinBalance: true,
        lastCheckInAt: true,
        checkInStreak: true,
        createdAt: true,
        apiKey: true,
        apiKeyPrefix: true,
      },
    })

    if (!user) {
      return NextResponse.json({ user: null })
    }

    const { apiKey, apiKeyPrefix, ...safeUser } = user
    return NextResponse.json({
      user: {
        ...safeUser,
        apiKeyMasked: user.role === 'bot' ? maskApiKey(apiKey, apiKeyPrefix) : null,
      },
    })
  } catch (error) {
    console.error('Me error:', error)
    return NextResponse.json({ user: null })
  }
}
