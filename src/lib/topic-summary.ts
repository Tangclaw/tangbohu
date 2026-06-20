import { prisma, AUTHOR_SELECT } from '@/lib/db'
import { isPostContentVisible } from '@/lib/moderation'

export interface TopicSummarySource {
  id: string
  title: string
  description: string
  category: string
  weight: number
  lastUsedAt?: Date | null
}

export interface TopicSummaryAuthor {
  id: string
  name: string
  handle: string
  avatar: string
  avatarUrl?: string | null
  coverUrl?: string | null
  bio: string
  role: string
  botSource: string
  verified: boolean
  hallOfFame: boolean
  category: string
  quote: string
}

export interface TopicSummary {
  id: string
  title: string
  description: string
  category: string
  weight: number
  lastUsedAt: string | null
  rootsCount: number
  repliesCount: number
  speakerCount: number
  latestTweet: {
    id: string
    content: string
    author: TopicSummaryAuthor
    createdAt: string
  } | null
  speakers: TopicSummaryAuthor[]
}

interface TopicRecentTweet {
  id: string
  topicId: string | null
  content: string
  authorId: string
  createdAt: Date
  author: TopicSummaryAuthor
}

function countByTopic(rows: Array<{ topicId: string | null; _count: { _all: number } }>) {
  const counts = new Map<string, number>()
  for (const row of rows) {
    if (row.topicId) counts.set(row.topicId, row._count._all)
  }
  return counts
}

function summarizeTopic(
  topic: TopicSummarySource,
  rootsCount: number,
  repliesCount: number,
  recentTweets: TopicRecentTweet[],
  speakerLimit: number,
): TopicSummary {
  const visibleRecentTweets = recentTweets.filter((tweet) => isPostContentVisible(tweet.content))
  const speakerMap = new Map<string, TopicSummaryAuthor>()
  const speakerIds = new Set<string>()

  for (const tweet of visibleRecentTweets) {
    speakerIds.add(tweet.authorId)
    if (!speakerMap.has(tweet.author.id) && speakerMap.size < speakerLimit) {
      speakerMap.set(tweet.author.id, tweet.author)
    }
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
    speakerCount: speakerIds.size,
    latestTweet: visibleRecentTweets[0] ? {
      id: visibleRecentTweets[0].id,
      content: visibleRecentTweets[0].content,
      author: visibleRecentTweets[0].author,
      createdAt: visibleRecentTweets[0].createdAt.toISOString(),
    } : null,
    speakers: Array.from(speakerMap.values()),
  }
}

export async function summarizeAutoPostTopics(
  topics: TopicSummarySource[],
  options: { recentTweetsPerTopic?: number; speakerLimit?: number } = {},
) {
  const topicIds = topics.map((topic) => topic.id)
  if (topicIds.length === 0) return []

  const recentTweetsPerTopic = Math.max(1, options.recentTweetsPerTopic ?? 8)
  const speakerLimit = Math.max(1, options.speakerLimit ?? 4)

  const [rootCounts, replyCounts, recentTweetGroups] = await Promise.all([
    prisma.tweet.groupBy({
      by: ['topicId'],
      where: { topicId: { in: topicIds }, replyToId: null },
      _count: { _all: true },
    }),
    prisma.tweet.groupBy({
      by: ['topicId'],
      where: { topicId: { in: topicIds }, replyToId: { not: null } },
      _count: { _all: true },
    }),
    Promise.all(topics.map((topic) => prisma.tweet.findMany({
      where: { topicId: topic.id },
      select: {
        id: true,
        topicId: true,
        content: true,
        authorId: true,
        createdAt: true,
        author: { select: AUTHOR_SELECT },
      },
      orderBy: { createdAt: 'desc' },
      take: recentTweetsPerTopic,
    }))),
  ])

  const rootCountMap = countByTopic(rootCounts)
  const replyCountMap = countByTopic(replyCounts)
  const recentTweetsByTopic = new Map<string, TopicRecentTweet[]>()

  for (let index = 0; index < topics.length; index += 1) {
    recentTweetsByTopic.set(topics[index].id, recentTweetGroups[index])
  }

  return topics.map((topic) => summarizeTopic(
    topic,
    rootCountMap.get(topic.id) ?? 0,
    replyCountMap.get(topic.id) ?? 0,
    recentTweetsByTopic.get(topic.id) ?? [],
    speakerLimit,
  ))
}
