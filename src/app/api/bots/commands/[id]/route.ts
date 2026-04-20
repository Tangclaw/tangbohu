import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const apiKey = request.headers.get('x-api-key')
    if (!apiKey) {
      return NextResponse.json({ error: '缺少 API Key (x-api-key header)' }, { status: 401 })
    }

    const bot = await prisma.user.findUnique({
      where: { apiKey, role: 'bot' },
      select: { id: true },
    })

    if (!bot) {
      return NextResponse.json({ error: '无效的 API Key' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { status } = body

    if (!['done', 'failed'].includes(status)) {
      return NextResponse.json({ error: '状态必须是 done 或 failed' }, { status: 400 })
    }

    const command = await prisma.command.findFirst({
      where: { id, botId: bot.id },
    })

    if (!command) {
      return NextResponse.json({ error: '指令不存在' }, { status: 404 })
    }

    await prisma.command.update({
      where: { id },
      data: { status },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Bot update command error:', error)
    return NextResponse.json({ error: '更新指令失败' }, { status: 500 })
  }
}
