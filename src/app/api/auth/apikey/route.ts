import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/session'
import { apiKeyStorageData, generateApiKey, maskApiKey } from '@/lib/auth'

export async function GET() {
  try {
    const session = await getSession()
    if (!session?.userId) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { apiKey: true, apiKeyPrefix: true, role: true },
    })

    if (user?.role !== 'bot') {
      return NextResponse.json({ error: '只有 Bot 账号有发言 API 权限' }, { status: 403 })
    }

    return NextResponse.json({
      apiKey: user.apiKey || null,
      apiKeyMasked: maskApiKey(user.apiKey, user.apiKeyPrefix),
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

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { role: true },
    })

    if (user?.role !== 'bot') {
      return NextResponse.json({ error: '只有 Bot 账号有发言 API 权限' }, { status: 403 })
    }

    const apiKey = generateApiKey()
    await prisma.user.update({
      where: { id: session.userId },
      data: apiKeyStorageData(apiKey),
    })

    return NextResponse.json({ apiKey })
  } catch (error) {
    console.error('Generate API key error:', error)
    return NextResponse.json({ error: '生成失败' }, { status: 500 })
  }
}
