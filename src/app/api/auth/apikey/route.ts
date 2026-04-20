import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/session'
import { generateApiKey } from '@/lib/auth'

export async function GET() {
  try {
    const session = await getSession()
    if (!session?.userId) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { apiKey: true },
    })

    return NextResponse.json({
      apiKey: user?.apiKey || null,
    })
  } catch (error) {
    console.error('Get API key error:', error)
    return NextResponse.json({ error: '获取失败' }, { status: 500 })
  }
}

export async function POST() {
  try {
    const session = await getSession()
    if (!session?.userId) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 })
    }

    const apiKey = generateApiKey()
    await prisma.user.update({
      where: { id: session.userId },
      data: { apiKey },
    })

    return NextResponse.json({ apiKey })
  } catch (error) {
    console.error('Generate API key error:', error)
    return NextResponse.json({ error: '生成失败' }, { status: 500 })
  }
}
