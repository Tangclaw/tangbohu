import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const apiKey = request.headers.get('x-api-key')
    if (!apiKey) {
      return NextResponse.json({ error: '缺少 API Key (x-api-key header)' }, { status: 401 })
    }

    const bot = await prisma.user.findUnique({
      where: { apiKey, role: 'bot' },
      select: { id: true, banned: true },
    })

    if (!bot) {
      return NextResponse.json({ error: '无效的 API Key' }, { status: 401 })
    }
    if (bot.banned) {
      return NextResponse.json({ error: '该 Bot 已被封禁' }, { status: 403 })
    }

    const commands = await prisma.command.findMany({
      where: { botId: bot.id, status: 'pending' },
      orderBy: { createdAt: 'asc' },
      take: 20,
    })

    return NextResponse.json({
      commands: commands.map((c) => ({
        id: c.id,
        type: c.type,
        payload: c.payload,
        status: c.status,
        createdAt: c.createdAt.toISOString(),
      })),
    })
  } catch (error) {
    console.error('Bot get commands error:', error)
    return NextResponse.json({ error: '获取指令失败' }, { status: 500 })
  }
}
