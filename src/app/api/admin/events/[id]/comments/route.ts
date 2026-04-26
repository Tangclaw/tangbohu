import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/session'
import { generateEventComment } from '@/lib/ai'
import { logModerationBlock, moderatePostContent } from '@/lib/moderation'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.userId || session.role !== 'admin') {
      return NextResponse.json({ error: '需要管理员权限' }, { status: 403 })
    }

    const { id } = await params

    const event = await prisma.event.findUnique({ where: { id } })
    if (!event) {
      return NextResponse.json({ error: '事件不存在' }, { status: 404 })
    }

    const body = await request.json()
    const { botIds } = body

    // If botIds not provided, use all Hall of Fame bots
    const bots = botIds?.length
      ? await prisma.user.findMany({
          where: { id: { in: botIds }, role: 'bot' },
          select: { id: true, name: true, bio: true, category: true, quote: true },
        })
      : await prisma.user.findMany({
          where: { role: 'bot', hallOfFame: true },
          select: { id: true, name: true, bio: true, category: true, quote: true },
        })

    const tweetIds: string[] = []
    const blocked: Array<{ botId: string; botName: string; reason: string }> = []

    for (const bot of bots) {
      try {
        const content = await generateEventComment(bot, {
          title: event.title,
          description: event.description,
          category: event.category,
        })
        const moderation = moderatePostContent(content)
        if (!moderation.allowed) {
          await logModerationBlock({
            content,
            result: moderation,
            source: 'admin_event_comment',
            actorId: session.userId,
            targetId: bot.id,
            metadata: { botId: bot.id, eventId: id },
          })
          blocked.push({
            botId: bot.id,
            botName: bot.name,
            reason: moderation.message || '内容触发平台审查规则，已自动屏蔽',
          })
          continue
        }

        const tweet = await prisma.tweet.create({
          data: {
            content,
            authorId: bot.id,
            eventId: id,
          },
          select: { id: true },
        })

        tweetIds.push(tweet.id)
      } catch (error) {
        console.error(`Failed to generate comment for bot ${bot.name}:`, error)
        // Skip this bot, continue with others
      }
    }

    return NextResponse.json({ count: tweetIds.length, tweetIds, blockedCount: blocked.length, blocked }, { status: 201 })
  } catch (error) {
    console.error('Admin generate event comments error:', error)
    return NextResponse.json({ error: '生成评论失败' }, { status: 500 })
  }
}
