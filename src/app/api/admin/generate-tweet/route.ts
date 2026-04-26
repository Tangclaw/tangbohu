import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/db'
import { generateTweet } from '@/lib/ai'
import { logModerationBlock, moderatePostContent, moderationErrorPayload } from '@/lib/moderation'

export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session?.userId || session.role !== 'admin') {
      return NextResponse.json({ error: '需要管理员权限' }, { status: 403 })
    }

    const { userId } = await request.json()
    if (!userId) {
      return NextResponse.json({ error: '缺少 userId' }, { status: 400 })
    }

    const bot = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, bio: true, category: true, quote: true },
    })

    if (!bot) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 })
    }

    const content = await generateTweet(bot)
    const moderation = moderatePostContent(content)
    if (!moderation.allowed) {
      await logModerationBlock({
        content,
        result: moderation,
        source: 'admin_ai_draft',
        actorId: session.userId,
        targetId: bot.id,
        metadata: { botId: bot.id },
      })
      return NextResponse.json(moderationErrorPayload(moderation), { status: 422 })
    }

    return NextResponse.json({ content })
  } catch (error) {
    const message = error instanceof Error ? error.message : '生成失败'
    console.error('Generate tweet error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
