import { readFile } from 'fs/promises'
import { randomUUID } from 'crypto'
import { resolve } from 'path'
import bcrypt from 'bcryptjs'
import { apiKeyStorageData } from '@/lib/auth'
import { prisma } from '@/lib/db'

const DEFAULT_INPUT = 'prisma/snapshots/forum-demo-data.json'

type SnapshotUser = {
  id: string
  name: string
  handle: string
  avatar: string
  avatarUrl: string | null
  coverUrl: string | null
  bio: string
  role: string
  botSource: string
  verified: boolean
  banned: boolean
  hallOfFame: boolean
  category: string
  quote: string
  createdAt: string | null
}

type SnapshotTweet = {
  id: string
  content: string
  authorId: string
  replyToId: string | null
  eventId: string | null
  likesCount: number
  retweetsCount: number
  repliesCount: number
  viewsCount: number
  tipsCount: number
  createdAt: string | null
}

type SnapshotEvent = {
  id: string
  title: string
  description: string
  category: string
  status: string
  createdAt: string | null
}

type SnapshotTopic = {
  id: string
  title: string
  description: string
  category: string
  weight: number
  enabled: boolean
  lastUsedAt: string | null
  createdAt: string | null
}

type SnapshotSchedule = {
  id: string
  name: string
  enabled: boolean
  scope: string
  intervalMinutes: number
  postsPerRun: number
  repliesPerPost: number
  nextRunAt: string | null
  lastRunAt: string | null
  lastRunCount: number
  lastRunMessage: string
  createdAt: string | null
}

type Snapshot = {
  version: number
  users: SnapshotUser[]
  tweets: SnapshotTweet[]
  events: SnapshotEvent[]
  autoPostTopics: SnapshotTopic[]
  autoPostSchedules: SnapshotSchedule[]
}

export type DemoDataImportResult = {
  users: number
  tweets: number
  events: number
  autoPostTopics: number
  autoPostSchedules: number
}

export function demoDataSnapshotPath(input?: string) {
  return resolve(process.cwd(), input || DEFAULT_INPUT)
}

function dateOrNow(value: string | null | undefined) {
  return value ? new Date(value) : new Date()
}

function dateOrNull(value: string | null | undefined) {
  return value ? new Date(value) : null
}

function botEmail(handle: string) {
  return `${handle.replace('@', '')}@bot.ai-twitter.com`
}

export async function importDemoDataSnapshot(input?: string): Promise<DemoDataImportResult> {
  const source = demoDataSnapshotPath(input)
  const snapshot = JSON.parse(await readFile(source, 'utf8')) as Snapshot
  if (snapshot.version !== 1) {
    throw new Error(`Unsupported snapshot version: ${snapshot.version}`)
  }

  const passwordHash = await bcrypt.hash('bot123', 12)
  const userIdMap = new Map<string, string>()
  const eventIdMap = new Map<string, string>()
  const tweetIdMap = new Map<string, string>()

  for (const user of snapshot.users) {
    const existing = await prisma.user.findUnique({
      where: { handle: user.handle },
      select: { id: true, apiKey: true, apiKeyHash: true, apiKeyPrefix: true, email: true },
    })
    const generatedApiKey = `ait_${randomUUID().replace(/-/g, '')}`
    const apiKeyData = existing?.apiKeyHash
      ? { apiKey: null, apiKeyHash: existing.apiKeyHash, apiKeyPrefix: existing.apiKeyPrefix }
      : existing?.apiKey
        ? apiKeyStorageData(existing.apiKey)
        : apiKeyStorageData(generatedApiKey)
    const saved = await prisma.user.upsert({
      where: { handle: user.handle },
      update: {
        name: user.name,
        avatar: user.avatar,
        avatarUrl: user.avatarUrl,
        coverUrl: user.coverUrl,
        bio: user.bio,
        role: 'bot',
        botSource: 'official',
        ...apiKeyData,
        verified: user.verified,
        banned: user.banned,
        hallOfFame: user.hallOfFame,
        category: user.category,
        quote: user.quote,
      },
      create: {
        id: user.id,
        email: existing?.email || botEmail(user.handle),
        passwordHash,
        name: user.name,
        handle: user.handle,
        avatar: user.avatar,
        avatarUrl: user.avatarUrl,
        coverUrl: user.coverUrl,
        bio: user.bio,
        role: 'bot',
        botSource: 'official',
        ...apiKeyData,
        verified: user.verified,
        banned: user.banned,
        hallOfFame: user.hallOfFame,
        category: user.category,
        quote: user.quote,
        createdAt: dateOrNow(user.createdAt),
      },
      select: { id: true },
    })
    userIdMap.set(user.id, saved.id)
  }

  for (const event of snapshot.events) {
    const saved = await prisma.event.upsert({
      where: { id: event.id },
      update: {
        title: event.title,
        description: event.description,
        category: event.category,
        status: event.status,
      },
      create: {
        id: event.id,
        title: event.title,
        description: event.description,
        category: event.category,
        status: event.status,
        createdAt: dateOrNow(event.createdAt),
      },
      select: { id: true },
    })
    eventIdMap.set(event.id, saved.id)
  }

  for (const topic of snapshot.autoPostTopics) {
    await prisma.autoPostTopic.upsert({
      where: { id: topic.id },
      update: {
        title: topic.title,
        description: topic.description,
        category: topic.category,
        weight: topic.weight,
        enabled: topic.enabled,
        lastUsedAt: dateOrNull(topic.lastUsedAt),
      },
      create: {
        id: topic.id,
        title: topic.title,
        description: topic.description,
        category: topic.category,
        weight: topic.weight,
        enabled: topic.enabled,
        lastUsedAt: dateOrNull(topic.lastUsedAt),
        createdAt: dateOrNow(topic.createdAt),
      },
    })
  }

  for (const schedule of snapshot.autoPostSchedules) {
    await prisma.autoPostSchedule.upsert({
      where: { id: schedule.id },
      update: {
        name: schedule.name,
        enabled: schedule.enabled,
        scope: schedule.scope,
        intervalMinutes: schedule.intervalMinutes,
        postsPerRun: schedule.postsPerRun,
        repliesPerPost: schedule.repliesPerPost,
        nextRunAt: dateOrNow(schedule.nextRunAt),
        lastRunAt: dateOrNull(schedule.lastRunAt),
        lastRunCount: schedule.lastRunCount,
        lastRunMessage: schedule.lastRunMessage,
      },
      create: {
        id: schedule.id,
        name: schedule.name,
        enabled: schedule.enabled,
        scope: schedule.scope,
        intervalMinutes: schedule.intervalMinutes,
        postsPerRun: schedule.postsPerRun,
        repliesPerPost: schedule.repliesPerPost,
        nextRunAt: dateOrNow(schedule.nextRunAt),
        lastRunAt: dateOrNull(schedule.lastRunAt),
        lastRunCount: schedule.lastRunCount,
        lastRunMessage: schedule.lastRunMessage,
        createdAt: dateOrNow(schedule.createdAt),
      },
    })
  }

  for (const tweet of snapshot.tweets) {
    const authorId = userIdMap.get(tweet.authorId)
    if (!authorId) continue
    const replyToId = tweet.replyToId ? tweetIdMap.get(tweet.replyToId) : null
    const eventId = tweet.eventId ? eventIdMap.get(tweet.eventId) || tweet.eventId : null
    const saved = await prisma.tweet.upsert({
      where: { id: tweet.id },
      update: {
        content: tweet.content,
        authorId,
        replyToId,
        eventId,
        likesCount: tweet.likesCount,
        retweetsCount: tweet.retweetsCount,
        viewsCount: tweet.viewsCount,
        tipsCount: tweet.tipsCount,
        createdAt: dateOrNow(tweet.createdAt),
      },
      create: {
        id: tweet.id,
        content: tweet.content,
        authorId,
        replyToId,
        eventId,
        likesCount: tweet.likesCount,
        retweetsCount: tweet.retweetsCount,
        repliesCount: tweet.repliesCount,
        viewsCount: tweet.viewsCount,
        tipsCount: tweet.tipsCount,
        createdAt: dateOrNow(tweet.createdAt),
      },
      select: { id: true },
    })
    tweetIdMap.set(tweet.id, saved.id)
  }

  for (const tweet of snapshot.tweets) {
    if (tweet.replyToId) continue
    const id = tweetIdMap.get(tweet.id)
    if (!id) continue
    const repliesCount = await prisma.tweet.count({ where: { replyToId: id } })
    await prisma.tweet.update({ where: { id }, data: { repliesCount } })
  }

  return {
    users: userIdMap.size,
    tweets: tweetIdMap.size,
    events: eventIdMap.size,
    autoPostTopics: snapshot.autoPostTopics.length,
    autoPostSchedules: snapshot.autoPostSchedules.length,
  }
}
