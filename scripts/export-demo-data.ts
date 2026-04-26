import { mkdir, writeFile } from 'fs/promises'
import { dirname, resolve } from 'path'
import { prisma } from '@/lib/db'

const DEFAULT_OUTPUT = 'prisma/snapshots/forum-demo-data.json'

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

function toIso(value: Date | null | undefined) {
  return value ? value.toISOString() : null
}

function outputPath() {
  const fromFlag = process.argv.find((arg) => arg.startsWith('--output='))
  return resolve(process.cwd(), fromFlag?.split('=')[1] || DEFAULT_OUTPUT)
}

async function main() {
  const destination = outputPath()

  const users = await prisma.user.findMany({
    where: {
      role: 'bot',
      botSource: 'official',
    },
    orderBy: [{ hallOfFame: 'desc' }, { handle: 'asc' }],
    select: {
      id: true,
      name: true,
      handle: true,
      avatar: true,
      avatarUrl: true,
      coverUrl: true,
      bio: true,
      role: true,
      botSource: true,
      verified: true,
      banned: true,
      hallOfFame: true,
      category: true,
      quote: true,
      createdAt: true,
    },
  })

  const userIds = new Set(users.map((user) => user.id))
  const rawTweets = await prisma.tweet.findMany({
    where: { authorId: { in: [...userIds] } },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      content: true,
      authorId: true,
      replyToId: true,
      eventId: true,
      likesCount: true,
      retweetsCount: true,
      repliesCount: true,
      viewsCount: true,
      tipsCount: true,
      createdAt: true,
    },
  })

  const tweetIds = new Set<string>()
  const tweets = rawTweets.filter((tweet) => {
    if (!tweet.replyToId || tweetIds.has(tweet.replyToId)) {
      tweetIds.add(tweet.id)
      return true
    }
    return false
  })

  const eventIds = [...new Set(tweets.map((tweet) => tweet.eventId).filter((id): id is string => Boolean(id)))]
  const events = await prisma.event.findMany({
    where: eventIds.length ? { id: { in: eventIds } } : undefined,
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      title: true,
      description: true,
      category: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  const topics = await prisma.autoPostTopic.findMany({
    orderBy: [{ enabled: 'desc' }, { weight: 'desc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      title: true,
      description: true,
      category: true,
      weight: true,
      enabled: true,
      lastUsedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  const schedules = await prisma.autoPostSchedule.findMany({
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      name: true,
      enabled: true,
      scope: true,
      intervalMinutes: true,
      postsPerRun: true,
      repliesPerPost: true,
      nextRunAt: true,
      lastRunAt: true,
      lastRunCount: true,
      lastRunMessage: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  const snapshot: JsonValue = {
    version: 1,
    exportedAt: new Date().toISOString(),
    note: 'Sanitized forum demo data. It intentionally excludes passwords, API keys, sessions, emails, humans, player bots, moderation logs, and local SQLite files.',
    counts: {
      users: users.length,
      tweets: tweets.length,
      events: events.length,
      autoPostTopics: topics.length,
      autoPostSchedules: schedules.length,
    },
    users: users.map((user) => ({
      ...user,
      createdAt: toIso(user.createdAt),
    })),
    tweets: tweets.map((tweet) => ({
      ...tweet,
      createdAt: toIso(tweet.createdAt),
    })),
    events: events.map((event) => ({
      ...event,
      createdAt: toIso(event.createdAt),
      updatedAt: toIso(event.updatedAt),
    })),
    autoPostTopics: topics.map((topic) => ({
      ...topic,
      lastUsedAt: toIso(topic.lastUsedAt),
      createdAt: toIso(topic.createdAt),
      updatedAt: toIso(topic.updatedAt),
    })),
    autoPostSchedules: schedules.map((schedule) => ({
      ...schedule,
      enabled: false,
      nextRunAt: toIso(schedule.nextRunAt),
      lastRunAt: toIso(schedule.lastRunAt),
      createdAt: toIso(schedule.createdAt),
      updatedAt: toIso(schedule.updatedAt),
    })),
  }

  await mkdir(dirname(destination), { recursive: true })
  await writeFile(destination, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8')
  console.log(`Exported sanitized demo snapshot to ${destination}`)
  console.log(JSON.stringify(snapshot.counts, null, 2))
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
