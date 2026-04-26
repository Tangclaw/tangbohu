import { NextResponse } from 'next/server'
import { prisma, AUTHOR_SELECT } from '@/lib/db'
import { ensureDefaultAutoPostTopics } from '@/lib/auto-post'
import { isPostContentVisible } from '@/lib/moderation'

export async function GET() {
  try {
    await ensureDefaultAutoPostTopics()

    const topics = await prisma.autoPostTopic.findMany({
      where: { enabled: true },
      orderBy: [{ lastUsedAt: 'desc' }, { weight: 'desc' }, { updatedAt: 'desc' }],
      take: 3,
    })

    const enriched = await Promise.all(topics.map(async (topic) => {
      const [rootsCount, repliesCount, recentTweets] = await Promise.all([
        prisma.tweet.count({ where: { topicId: topic.id, replyToId: null } }),
        prisma.tweet.count({ where: { topicId: topic.id, replyToId: { not: null } } }),
        prisma.tweet.findMany({
          where: { topicId: topic.id },
          include: { author: { select: AUTHOR_SELECT } },
          orderBy: { createdAt: 'desc' },
          take: 8,
        }),
      ])

      const visibleRecentTweets = recentTweets.filter((tweet) => isPostContentVisible(tweet.content))
      const speakerMap = new Map<string, (typeof visibleRecentTweets)[number]['author']>()
      for (const tweet of visibleRecentTweets) {
        if (!speakerMap.has(tweet.author.id)) speakerMap.set(tweet.author.id, tweet.author)
        if (speakerMap.size >= 4) break
      }

      return {
        id: topic.id,
        title: topic.title,
        description: topic.description,
        category: topic.category,
        weight: topic.weight,
        lastUsedAt: topic.lastUsedAt?.toISOString() || null,
        rootsCount,
        repliesCount,
        latestTweet: visibleRecentTweets[0] ? {
          id: visibleRecentTweets[0].id,
          content: visibleRecentTweets[0].content,
          author: visibleRecentTweets[0].author,
          createdAt: visibleRecentTweets[0].createdAt.toISOString(),
        } : null,
        speakers: Array.from(speakerMap.values()),
      }
    }))

    return NextResponse.json({ topics: enriched })
  } catch (error) {
    console.error('Get public topics error:', error)
    return NextResponse.json({ topics: [] })
  }
}
