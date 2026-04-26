import { NextResponse } from 'next/server'
import { prisma, AUTHOR_SELECT } from '@/lib/db'
import { getSession } from '@/lib/session'
import { moderatePostContent } from '@/lib/moderation'

function parseJsonList(value: string) {
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : []
  } catch {
    return []
  }
}

export async function GET() {
  try {
    const session = await getSession()
    if (!session?.userId || session.role !== 'admin') {
      return NextResponse.json({ error: '需要管理员权限' }, { status: 403 })
    }

    const tweets = await prisma.tweet.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        content: true,
        createdAt: true,
        author: {
          select: { ...AUTHOR_SELECT, createdAt: true },
        },
      },
    })

    const categoryCounts: Record<string, number> = {}
    const blocked = tweets
      .map((tweet) => {
        const result = moderatePostContent(tweet.content)
        if (result.allowed) return null

        for (const category of new Set(result.matches.map((match) => match.category))) {
          categoryCounts[category] = (categoryCounts[category] || 0) + 1
        }

        return {
          id: tweet.id,
          content: tweet.content,
          createdAt: tweet.createdAt.toISOString(),
          author: {
            ...tweet.author,
            createdAt: tweet.author.createdAt.toISOString(),
          },
          categories: Array.from(new Set(result.matches.map((match) => match.category))),
          labels: Array.from(new Set(result.matches.map((match) => match.label))),
        }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)

    const customTerms = (process.env.CONTENT_MODERATION_BLOCKLIST || '')
      .split(',')
      .map((term) => term.trim())
      .filter(Boolean)

    const logs = await prisma.moderationLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    return NextResponse.json({
      totalTweets: tweets.length,
      visibleTweets: tweets.length - blocked.length,
      blockedTweets: blocked.length,
      blockedAttempts: await prisma.moderationLog.count(),
      categoryCounts,
      customBlocklistEnabled: customTerms.length > 0,
      customTermCount: customTerms.length,
      samples: blocked.slice(0, 20),
      logs: logs.map((log) => ({
        id: log.id,
        source: log.source,
        content: log.content,
        actorId: log.actorId,
        targetId: log.targetId,
        categories: parseJsonList(log.categories),
        labels: parseJsonList(log.labels),
        createdAt: log.createdAt.toISOString(),
      })),
    })
  } catch (error) {
    console.error('Admin moderation error:', error)
    return NextResponse.json({ error: '获取审查信息失败' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session?.userId || session.role !== 'admin') {
      return NextResponse.json({ error: '需要管理员权限' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const content = typeof body.content === 'string' ? body.content.trim() : ''

    if (!content) {
      return NextResponse.json({ error: '请输入要测试的内容' }, { status: 400 })
    }
    if (content.length > 1000) {
      return NextResponse.json({ error: '测试内容不能超过1000个字符' }, { status: 400 })
    }

    const result = moderatePostContent(content)
    return NextResponse.json({
      allowed: result.allowed,
      blocked: !result.allowed,
      message: result.allowed ? '内容可发布' : result.message,
      categories: Array.from(new Set(result.matches.map((match) => match.category))),
      labels: Array.from(new Set(result.matches.map((match) => match.label))),
      matches: result.matches,
    })
  } catch (error) {
    console.error('Admin moderation test error:', error)
    return NextResponse.json({ error: '审查测试失败' }, { status: 500 })
  }
}
