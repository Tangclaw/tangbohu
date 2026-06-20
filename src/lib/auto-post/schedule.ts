import { prisma } from '@/lib/db'
import { getAiProviderStatus } from '@/lib/ai'
import { ACADEMIC_AUTO_POST_TOPICS } from '@/lib/academic-questions'
import { DAILY_TOPIC_CATALOG, DEFAULT_TOPICS } from './templates'
import { clampNumber, normalizeScope, getScopeWhere } from './utils'
import {
  DEFAULT_AUTO_POST_SCHEDULE_ID,
  DEFAULT_AUTO_POST_INTERVAL_MINUTES,
  DEFAULT_AUTO_POST_POSTS_PER_RUN,
  DEFAULT_AUTO_POST_REPLIES_PER_POST,
} from './types'
import { isAutoPostScheduleStaleLock } from './types'

const DAILY_TOPIC_PREFIX = 'daily_topic_'
const PUBLIC_TOPIC_POOL_SIZE = 3
const TOPIC_POOL_TIME_ZONE = process.env.TOPIC_POOL_TIME_ZONE || 'Asia/Shanghai'

function dateKeyParts(now: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TOPIC_POOL_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const value = (type: string) => parts.find((part) => part.type === type)?.value || ''
  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
  }
}

export function getPublicTopicDayKey(now = new Date()) {
  const { year, month, day } = dateKeyParts(now)
  return `${year}-${month}-${day}`
}

function dailyTopicId(dayKey: string, templateId: string) {
  return `${DAILY_TOPIC_PREFIX}${dayKey.replace(/-/g, '')}_${templateId}`
}

export function isDailyAutoPostTopicId(topicId: string) {
  return topicId.startsWith(DAILY_TOPIC_PREFIX)
}

function dayIndex(dayKey: string) {
  const [year, month, day] = dayKey.split('-').map(Number)
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000)
}

export function getDailyTopicTemplateSelection(now = new Date()) {
  const dayKey = getPublicTopicDayKey(now)
  const start = (dayIndex(dayKey) * PUBLIC_TOPIC_POOL_SIZE) % DAILY_TOPIC_CATALOG.length
  return Array.from({ length: PUBLIC_TOPIC_POOL_SIZE }, (_, index) => (
    DAILY_TOPIC_CATALOG[(start + index) % DAILY_TOPIC_CATALOG.length]
  ))
}

export function getDailyAutoPostTopicIds(now = new Date()) {
  const dayKey = getPublicTopicDayKey(now)
  return getDailyTopicTemplateSelection(now).map((topic) => dailyTopicId(dayKey, topic.id))
}

export function formatAutoPostTopicsForAdmin<T extends { id: string }>(topics: T[], now = new Date()) {
  const dayKey = getPublicTopicDayKey(now)
  const todayDailyIds = new Set(getDailyAutoPostTopicIds(now))
  return topics.map((topic) => ({
    ...topic,
    source: todayDailyIds.has(topic.id) ? 'daily-public' : isDailyAutoPostTopicId(topic.id) ? 'daily-archived' : 'custom',
    isDaily: isDailyAutoPostTopicId(topic.id),
    isTodayPublic: todayDailyIds.has(topic.id),
    dayKey: todayDailyIds.has(topic.id) ? dayKey : null,
  }))
}

export async function ensureDefaultAutoPostTopics() {
  for (const topic of [...DEFAULT_TOPICS, ...ACADEMIC_AUTO_POST_TOPICS]) {
    await prisma.autoPostTopic.upsert({
      where: { id: topic.id },
      update: {},
      create: topic,
    })
  }
}

export async function ensureAcademicAutoPostTopics() {
  for (const topic of ACADEMIC_AUTO_POST_TOPICS) {
    await prisma.autoPostTopic.upsert({
      where: { id: topic.id },
      update: {
        title: topic.title,
        description: topic.description,
        category: topic.category,
        weight: topic.weight,
        enabled: true,
      },
      create: {
        ...topic,
        enabled: true,
      },
    })
  }
}

export async function ensureDailyAutoPostTopics(now = new Date()) {
  await ensureDefaultAutoPostTopics()
  const selected = getDailyTopicTemplateSelection(now)
  const activeIds = getDailyAutoPostTopicIds(now)

  for (let index = 0; index < selected.length; index += 1) {
    const topic = selected[index]
    await prisma.autoPostTopic.upsert({
      where: { id: activeIds[index] },
      update: {
        title: topic.title,
        description: topic.description,
        category: topic.category,
        weight: topic.weight,
        enabled: true,
      },
      create: {
        id: activeIds[index],
        title: topic.title,
        description: topic.description,
        category: topic.category,
        weight: topic.weight,
        enabled: true,
      },
    })
  }

  await prisma.autoPostTopic.updateMany({
    where: {
      id: { startsWith: DAILY_TOPIC_PREFIX, notIn: activeIds },
      enabled: true,
    },
    data: { enabled: false },
  })

  return prisma.autoPostTopic.findMany({
    where: { id: { in: activeIds }, enabled: true },
  }).then((topics) => {
    const order = new Map(activeIds.map((id, index) => [id, index]))
    return topics.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
  })
}

export async function getPublicAutoPostTopics(now = new Date()) {
  return ensureDailyAutoPostTopics(now)
}

export async function getAutoPostTopics() {
  const dailyTopics = await ensureDailyAutoPostTopics()
  const todayDailyIds = dailyTopics.map((topic) => topic.id)
  return prisma.autoPostTopic.findMany({
    where: {
      OR: [
        { id: { in: todayDailyIds } },
        { NOT: { id: { startsWith: DAILY_TOPIC_PREFIX } } },
      ],
    },
    orderBy: [{ enabled: 'desc' }, { weight: 'desc' }, { updatedAt: 'desc' }],
  })
}

export async function getDailyTopicRuntimeStatus(now = new Date()) {
  const dayKey = getPublicTopicDayKey(now)
  const topics = await ensureDailyAutoPostTopics(now)
  const topicIds = topics.map((topic) => topic.id)
  if (topicIds.length === 0) {
    return {
      dayKey,
      topicIds,
      rootsCount: 0,
      attemptedToday: false,
      needsKickoff: false,
    }
  }

  const [rootsCount, recentRuns] = await Promise.all([
    prisma.tweet.count({
      where: {
        topicId: { in: topicIds },
        replyToId: null,
      },
    }),
    prisma.autoPostRunLog.findMany({
      where: {
        topicId: { in: topicIds },
        createdAt: { gte: new Date(now.getTime() - 36 * 60 * 60 * 1000) },
      },
      select: {
        startedAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 12,
    }),
  ])
  const attemptedToday = recentRuns.some((run) => getPublicTopicDayKey(run.startedAt) === dayKey)

  return {
    dayKey,
    topicIds,
    rootsCount,
    attemptedToday,
    needsKickoff: rootsCount === 0 && !attemptedToday,
  }
}

export async function shouldKickoffDailyTopics(schedule: { enabled: boolean }, now = new Date()) {
  if (!schedule.enabled) return false
  return (await getDailyTopicRuntimeStatus(now)).needsKickoff
}

export async function getAutoPostRunLogs(limit = 8) {
  return prisma.autoPostRunLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
}

export async function getAutoPostFreshness() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const tweets = await prisma.tweet.findMany({
    where: { createdAt: { gte: since } },
    select: {
      authorId: true,
      replyToId: true,
      author: { select: { role: true } },
    },
  })
  const botTweets = tweets.filter((tweet) => tweet.author.role === 'bot')

  return {
    roots24h: botTweets.filter((tweet) => !tweet.replyToId).length,
    replies24h: botTweets.filter((tweet) => tweet.replyToId).length,
    activeBots24h: new Set(botTweets.map((tweet) => tweet.authorId)).size,
  }
}

export async function getOrCreateAutoPostSchedule() {
  await ensureDefaultAutoPostTopics()
  return prisma.autoPostSchedule.upsert({
    where: { id: DEFAULT_AUTO_POST_SCHEDULE_ID },
    update: {},
    create: {
      id: DEFAULT_AUTO_POST_SCHEDULE_ID,
      name: '名人堂自动发帖',
      enabled: true,
      scope: 'hall_of_fame',
      intervalMinutes: DEFAULT_AUTO_POST_INTERVAL_MINUTES,
      postsPerRun: DEFAULT_AUTO_POST_POSTS_PER_RUN,
      repliesPerPost: DEFAULT_AUTO_POST_REPLIES_PER_POST,
      nextRunAt: new Date(Date.now() + DEFAULT_AUTO_POST_INTERVAL_MINUTES * 60 * 1000),
    },
  })
}

export async function updateAutoPostSchedule(input: {
  enabled?: unknown
  scope?: unknown
  intervalMinutes?: unknown
  postsPerRun?: unknown
  repliesPerPost?: unknown
}) {
  const current = await getOrCreateAutoPostSchedule()
  const intervalMinutes = clampNumber(input.intervalMinutes, current.intervalMinutes, 30, 24 * 60)
  const postsPerRun = clampNumber(input.postsPerRun, current.postsPerRun, 1, 4)
  const repliesPerPost = clampNumber(input.repliesPerPost, current.repliesPerPost, 0, 5)
  const scope = normalizeScope(input.scope ?? current.scope)
  const enabled = input.enabled === undefined ? current.enabled : Boolean(input.enabled)

  return prisma.autoPostSchedule.update({
    where: { id: current.id },
    data: {
      enabled,
      scope,
      intervalMinutes,
      postsPerRun,
      repliesPerPost,
      nextRunAt: new Date(Date.now() + intervalMinutes * 60 * 1000),
    },
  })
}

export async function unlockStaleAutoPostSchedule() {
  const schedule = await getOrCreateAutoPostSchedule()
  if (!isAutoPostScheduleStaleLock(schedule)) {
    return { unlocked: false, schedule }
  }

  const now = new Date()
  const nextRunAt = schedule.enabled ? now : schedule.nextRunAt
  const message = '过期执行锁已由管理员恢复'
  const updated = await prisma.autoPostSchedule.update({
    where: { id: schedule.id },
    data: {
      nextRunAt,
      lastRunMessage: message,
    },
  })

  await prisma.autoPostRunLog.create({
    data: {
      scheduleId: schedule.id,
      trigger: 'admin-unlock',
      providerStatus: getAiProviderStatus().configured ? 'configured' : 'template',
      model: getAiProviderStatus().model,
      message,
      startedAt: now,
      completedAt: now,
    },
  })

  return { unlocked: true, schedule: updated }
}

export async function countAutoPostScopeBots(scope: string) {
  return prisma.user.count({ where: getScopeWhere(scope) })
}

export async function pickRunTopic(topicId?: string | null, seed = Date.now()) {
  await ensureDailyAutoPostTopics()
  if (topicId) {
    const topic = await prisma.autoPostTopic.findUnique({ where: { id: topicId } })
    if (topic && topic.enabled) return topic
  }

  const topics = await getPublicAutoPostTopics()
  if (topics.length === 0) return (await getAutoPostTopics())[0]

  const total = topics.reduce((sum, topic) => sum + Math.max(1, topic.weight), 0)
  let cursor = Math.abs(seed) % total
  for (const topic of topics) {
    cursor -= Math.max(1, topic.weight)
    if (cursor < 0) return topic
  }
  return topics[0]
}

export async function pickRunTopics(topicId: string | null | undefined, count: number, seed = Date.now()) {
  const first = await pickRunTopic(topicId, seed)
  if (!first || topicId || count <= 1) return first ? [first] : []

  const topics = (await getPublicAutoPostTopics())
    .filter((topic) => topic.id !== first.id)
    .sort((a, b) => {
      const timeA = a.lastUsedAt?.getTime() ?? 0
      const timeB = b.lastUsedAt?.getTime() ?? 0
      return timeA - timeB || b.weight - a.weight
    })
  if (topics.length === 0) return [first]

  const picked = [first]
  let cursor = Math.abs(seed + 91) % topics.length
  while (picked.length < count && topics.length > 0) {
    const topic = topics[cursor % topics.length]
    if (!picked.some((item) => item.id === topic.id)) picked.push(topic)
    cursor += 1
    if (cursor > topics.length * 2) break
  }
  return picked
}
