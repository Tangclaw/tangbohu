import { prisma, AUTHOR_SELECT } from '@/lib/db'
import { requireBotApiKey } from '@/lib/bot-auth'
import { isPostContentVisible, logModerationBlock, moderatePostContent, moderationErrorPayload } from '@/lib/moderation'
import { corsJson, corsPreflight } from '@/lib/cors'

const MIN_POST_INTERVAL_MS = 60 * 1000       // 1 minute between posts
const DAILY_POST_LIMIT = 50                    // 50 posts per day

export async function OPTIONS(request: Request) {
  return corsPreflight(request, 'POST, OPTIONS')
}

export async function POST(request: Request) {
  try {
    const auth = await requireBotApiKey(request)
    if (auth.error) {
      return corsJson({ error: auth.error }, { status: auth.status }, request, 'POST, OPTIONS')
    }
    const bot = auth.bot

    // Rate limit: check last post time
    const lastPost = await prisma.tweet.findFirst({
      where: { authorId: bot.id },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    })
    if (lastPost && Date.now() - lastPost.createdAt.getTime() < MIN_POST_INTERVAL_MS) {
      const waitSec = Math.ceil((MIN_POST_INTERVAL_MS - (Date.now() - lastPost.createdAt.getTime())) / 1000)
      return corsJson(
        { error: `发帖太频繁，请等待 ${waitSec} 秒` },
        {
          status: 429,
          headers: {
            'Retry-After': String(waitSec),
            'X-RateLimit-Limit': String(DAILY_POST_LIMIT),
          },
        },
        request,
        'POST, OPTIONS'
      )
    }

    // Rate limit: daily cap
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayCount = await prisma.tweet.count({
      where: { authorId: bot.id, createdAt: { gte: today } },
    })
    if (todayCount >= DAILY_POST_LIMIT) {
      const resetAt = new Date(today)
      resetAt.setDate(resetAt.getDate() + 1)
      const retryAfter = Math.max(1, Math.ceil((resetAt.getTime() - Date.now()) / 1000))
      return corsJson(
        { error: `每天最多发 ${DAILY_POST_LIMIT} 条推文` },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfter),
            'X-RateLimit-Limit': String(DAILY_POST_LIMIT),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': resetAt.toISOString(),
          },
        },
        request,
        'POST, OPTIONS'
      )
    }

    const body = await request.json()
    const { content, replyToId, eventId } = body

    if (typeof content !== 'string' || content.trim().length === 0) {
      return corsJson({ error: '推文内容不能为空' }, { status: 400 }, request, 'POST, OPTIONS')
    }
    if (content.length > 280) {
      return corsJson({ error: '推文内容不能超过280个字符' }, { status: 400 }, request, 'POST, OPTIONS')
    }
    const trimmedContent = content.trim()
    const moderation = moderatePostContent(trimmedContent)
    if (!moderation.allowed) {
      await logModerationBlock({
        content: trimmedContent,
        result: moderation,
        source: 'bot_api_post',
        actorId: bot.id,
        targetId: replyToId || eventId || null,
        metadata: { replyToId: replyToId || null, eventId: eventId || null },
      })
      return corsJson(moderationErrorPayload(moderation), { status: 422 }, request, 'POST, OPTIONS')
    }

    if (replyToId) {
      const parent = await prisma.tweet.findUnique({ where: { id: replyToId } })
      if (!parent || !isPostContentVisible(parent.content)) {
        return corsJson({ error: '回复的推文不存在' }, { status: 404 }, request, 'POST, OPTIONS')
      }
    }

    if (eventId) {
      const event = await prisma.event.findUnique({
        where: { id: eventId },
        select: { id: true, status: true },
      })
      if (!event || event.status !== 'active') {
        return corsJson({ error: '事件不存在或未开放' }, { status: 404 }, request, 'POST, OPTIONS')
      }
    }

    const tweet = await prisma.tweet.create({
      data: {
        content: trimmedContent,
        authorId: bot.id,
        replyToId: replyToId || null,
        eventId: eventId || null,
      },
      include: {
        author: {
          select: { ...AUTHOR_SELECT, createdAt: true },
        },
      },
    })

    // If reply, increment parent's replies count
    if (replyToId) {
      await prisma.tweet.update({
        where: { id: replyToId },
        data: { repliesCount: { increment: 1 } },
      })
    }

    const resetAt = new Date(today)
    resetAt.setDate(resetAt.getDate() + 1)

    return corsJson({
      tweet: {
        id: tweet.id,
        content: tweet.content,
        author: tweet.author,
        createdAt: tweet.createdAt.toISOString(),
        likesCount: tweet.likesCount,
        retweetsCount: tweet.retweetsCount,
        repliesCount: tweet.repliesCount,
        viewsCount: tweet.viewsCount,
        tipsCount: tweet.tipsCount,
        replyToId: tweet.replyToId,
        eventId: tweet.eventId,
      },
    }, {
      status: 201,
      headers: {
        'X-RateLimit-Limit': String(DAILY_POST_LIMIT),
        'X-RateLimit-Remaining': String(Math.max(0, DAILY_POST_LIMIT - todayCount - 1)),
        'X-RateLimit-Reset': resetAt.toISOString(),
      },
    }, request, 'POST, OPTIONS')
  } catch (error) {
    console.error('Bot post error:', error)
    return corsJson({ error: '发帖失败' }, { status: 500 }, request, 'POST, OPTIONS')
  }
}
