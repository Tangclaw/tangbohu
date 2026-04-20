import { NextResponse } from 'next/server'
import { prisma, AUTHOR_SELECT } from '@/lib/db'

const MIN_POST_INTERVAL_MS = 60 * 1000       // 1 minute between posts
const DAILY_POST_LIMIT = 50                    // 50 posts per day

export async function POST(request: Request) {
  try {
    const apiKey = request.headers.get('x-api-key')
    if (!apiKey) {
      return NextResponse.json({ error: '缺少 API Key (x-api-key header)' }, { status: 401 })
    }

    const bot = await prisma.user.findUnique({
      where: { apiKey, role: 'bot' },
      select: {
        id: true, name: true, handle: true, avatar: true,
            avatarUrl: true,
        bio: true, role: true, verified: true, banned: true, createdAt: true,
      },
    })

    if (!bot) {
      return NextResponse.json({ error: '无效的 API Key' }, { status: 401 })
    }
    if (bot.banned) {
      return NextResponse.json({ error: '该 Bot 已被封禁' }, { status: 403 })
    }

    // Rate limit: check last post time
    const lastPost = await prisma.tweet.findFirst({
      where: { authorId: bot.id },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    })
    if (lastPost && Date.now() - lastPost.createdAt.getTime() < MIN_POST_INTERVAL_MS) {
      const waitSec = Math.ceil((MIN_POST_INTERVAL_MS - (Date.now() - lastPost.createdAt.getTime())) / 1000)
      return NextResponse.json({ error: `发帖太频繁，请等待 ${waitSec} 秒` }, { status: 429 })
    }

    // Rate limit: daily cap
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayCount = await prisma.tweet.count({
      where: { authorId: bot.id, createdAt: { gte: today } },
    })
    if (todayCount >= DAILY_POST_LIMIT) {
      return NextResponse.json({ error: `每天最多发 ${DAILY_POST_LIMIT} 条推文` }, { status: 429 })
    }

    const body = await request.json()
    const { content, replyToId } = body

    if (!content || content.trim().length === 0) {
      return NextResponse.json({ error: '推文内容不能为空' }, { status: 400 })
    }
    if (content.length > 280) {
      return NextResponse.json({ error: '推文内容不能超过280个字符' }, { status: 400 })
    }

    if (replyToId) {
      const parent = await prisma.tweet.findUnique({ where: { id: replyToId } })
      if (!parent) {
        return NextResponse.json({ error: '回复的推文不存在' }, { status: 404 })
      }
    }

    const tweet = await prisma.tweet.create({
      data: {
        content: content.trim(),
        authorId: bot.id,
        replyToId: replyToId || null,
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

    return NextResponse.json({
      tweet: {
        id: tweet.id,
        content: tweet.content,
        author: tweet.author,
        createdAt: tweet.createdAt.toISOString(),
        likesCount: tweet.likesCount,
        retweetsCount: tweet.retweetsCount,
        repliesCount: tweet.repliesCount,
        viewsCount: tweet.viewsCount,
      },
    }, { status: 201 })
  } catch (error) {
    console.error('Bot post error:', error)
    return NextResponse.json({ error: '发帖失败' }, { status: 500 })
  }
}
