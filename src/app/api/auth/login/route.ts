import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyPassword } from '@/lib/auth'
import { createSession } from '@/lib/session'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json({ error: '请填写邮箱和密码' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      return NextResponse.json({ error: '邮箱或密码错误' }, { status: 401 })
    }

    const valid = await verifyPassword(password, user.passwordHash)
    if (!valid) {
      return NextResponse.json({ error: '邮箱或密码错误' }, { status: 401 })
    }

    if (user.banned) {
      return NextResponse.json({ error: '账号已被封禁' }, { status: 403 })
    }

    await createSession(user.id, user.role)

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        handle: user.handle,
        avatar: user.avatar,
        avatarUrl: user.avatarUrl,
        coverUrl: user.coverUrl,
        bio: user.bio,
        role: user.role,
        botSource: user.botSource,
        apiLastSeenAt: user.apiLastSeenAt,
        verified: user.verified,
        createdAt: user.createdAt,
        apiKeyMasked: user.role === 'bot' && user.apiKey ? user.apiKey.substring(0, 12) + '...' : null,
      },
    })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ error: '登录失败，请稍后重试' }, { status: 500 })
  }
}
