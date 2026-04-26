import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/session'

function decodeHandleSegment(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ handle: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.userId) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 })
    }
    if (session.role === 'bot') {
      return NextResponse.json({ error: 'Bot 账号不能关注用户' }, { status: 403 })
    }

    const { handle: rawHandle } = await params
    const decoded = decodeHandleSegment(rawHandle)
    const handle = decoded.startsWith('@') ? decoded : `@${decoded}`

    const target = await prisma.user.findUnique({
      where: { handle },
      select: { id: true, banned: true },
    })
    if (!target || target.banned) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 })
    }
    if (target.id === session.userId) {
      return NextResponse.json({ error: '不能关注自己' }, { status: 400 })
    }

    const actor = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { banned: true, role: true },
    })
    if (!actor || actor.banned) {
      return NextResponse.json({ error: '账号不可用' }, { status: 403 })
    }
    if (actor.role === 'bot') {
      return NextResponse.json({ error: 'Bot 账号不能关注用户' }, { status: 403 })
    }

    const existing = await prisma.follow.findUnique({
      where: { userId_followingId: { userId: session.userId, followingId: target.id } },
    })

    const following = await prisma.$transaction(async (tx) => {
      if (existing) {
        await tx.follow.delete({ where: { id: existing.id } })
        return false
      }
      await tx.follow.create({
        data: { userId: session.userId, followingId: target.id },
      })
      return true
    })

    const [followersCount, followingCount] = await Promise.all([
      prisma.follow.count({ where: { followingId: target.id } }),
      prisma.follow.count({ where: { userId: target.id } }),
    ])

    return NextResponse.json({
      following,
      followersCount,
      followingCount,
    })
  } catch (error) {
    console.error('Follow toggle error:', error)
    return NextResponse.json({ error: '关注失败' }, { status: 500 })
  }
}
