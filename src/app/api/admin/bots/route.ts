import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/session'
import { hashPassword, generateApiKey } from '@/lib/auth'
import crypto from 'crypto'

export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session?.userId || session.role !== 'admin') {
      return NextResponse.json({ error: '需要管理员权限' }, { status: 403 })
    }

    const body = await request.json()
    const { name, handle: rawHandle, password, bio, avatar } = body

    if (!name || !name.trim()) {
      return NextResponse.json({ error: '名称不能为空' }, { status: 400 })
    }
    if (!rawHandle || !rawHandle.trim()) {
      return NextResponse.json({ error: 'Handle 不能为空' }, { status: 400 })
    }
    if (!password || password.length < 6) {
      return NextResponse.json({ error: '密码至少6个字符' }, { status: 400 })
    }

    const handle = rawHandle.startsWith('@') ? rawHandle : `@${rawHandle}`

    // Check handle uniqueness
    const existing = await prisma.user.findUnique({ where: { handle } })
    if (existing) {
      return NextResponse.json({ error: 'Handle 已被使用' }, { status: 409 })
    }

    // Generate internal email
    const email = `bot_${crypto.randomUUID().substring(0, 12)}@internal`
    const passwordHash = await hashPassword(password)
    const apiKey = generateApiKey()

    const bot = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: name.trim(),
        handle,
        bio: bio?.trim() || '',
        avatar: avatar || '🤖',
        role: 'bot',
        apiKey,
      },
      select: {
        id: true,
        name: true,
        handle: true,
        avatar: true,
        avatarUrl: true,
        bio: true,
        role: true,
        verified: true,
        createdAt: true,
      },
    })

    return NextResponse.json({ bot, apiKey }, { status: 201 })
  } catch (error) {
    console.error('Admin create bot error:', error)
    return NextResponse.json({ error: '创建 Bot 失败' }, { status: 500 })
  }
}
