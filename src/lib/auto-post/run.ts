import { prisma } from '@/lib/db'
import { getAiProviderStatus } from '@/lib/ai'
import { moderatePostContent, logModerationBlock } from '@/lib/moderation'
import type { AiTextResult } from '@/lib/ai'
import type { ReplyTarget, AutoPostRunResult, DebateTurn } from './types'
import { AUTO_POST_RUNNING_MESSAGE, AUTO_POST_CLAIM_LOCK_MS } from './types'
import type { AutoPostSchedule } from '@/generated/prisma/client'
import { getOrCreateAutoPostSchedule, pickRunTopics, shouldKickoffDailyTopics } from './schedule'
import { generatePostContent, fallbackPost } from './generation'
import { createReplyForTarget, pickReplyBots, pickNextReplyBot, catchUpRecentRootReplies, getDescendantReplies } from './replies'
import { getScopeWhere, trimTweet, randomInt, providerStatusLabel } from './utils'

async function ensureUniqueContent(authorId: string, content: string, seed: number) {
  const trimmed = trimTweet(content)
  const existing = await prisma.tweet.findFirst({
    where: { authorId, content: trimmed },
    select: { id: true },
  })
  if (!existing) return trimmed

  const suffix = ` #第${(seed % 97) + 1}轮观察`
  return trimTweet(`${trimmed.replace(/[。！？!?]$/, '')}。${suffix}`)
}

async function visibleAutoText(result: AiTextResult, fallback: string, metadata: Record<string, unknown>) {
  let content = result.content
  let source = result.source
  let error = result.error || ''
  let moderation = moderatePostContent(content)

  if (!moderation.allowed && source === 'model') {
    await logModerationBlock({ content, result: moderation, source: 'auto_post_schedule', metadata: { ...metadata, generationSource: 'model' } })
    content = fallback
    source = 'template'
    error = error || 'MODEL_CONTENT_BLOCKED'
    moderation = moderatePostContent(content)
  }

  if (!moderation.allowed) {
    await logModerationBlock({ content, result: moderation, source: 'auto_post_schedule', metadata: { ...metadata, generationSource: source } })
    return { ok: false as const, content, source, error }
  }

  return { ok: true as const, content, source, error }
}

async function refreshConversationReplyCount(rootId: string) {
  const replies = await getDescendantReplies(rootId)
  await prisma.tweet.update({
    where: { id: rootId },
    data: { repliesCount: replies.length },
  })
}

async function getBalancedBots(scope: string, limit: number) {
  const bots = await prisma.user.findMany({
    where: getScopeWhere(scope),
    select: { id: true, name: true, handle: true, bio: true, category: true, quote: true },
  })

  const stats = await Promise.all(
    bots.map(async (bot) => ({
      bot,
      count: await prisma.tweet.count({ where: { authorId: bot.id, replyToId: null } }),
    }))
  )

  return stats
    .sort((a, b) => a.count - b.count || a.bot.handle.localeCompare(b.bot.handle))
    .slice(0, Math.min(limit, stats.length))
    .map((item) => item.bot)
}

function skippedRunResult(schedule: AutoPostSchedule, message: string): AutoPostRunResult {
  return {
    scheduleId: schedule.id,
    scheduleName: schedule.name,
    scope: schedule.scope,
    topicId: null,
    topicTitle: '',
    createdRoots: 0,
    createdReplies: 0,
    blockedCount: 0,
    skippedCount: 1,
    failedCount: 0,
    fallbackCount: 0,
    providerStatus: getAiProviderStatus().configured ? 'configured' : 'template',
    message,
    nextRunAt: schedule.nextRunAt,
  }
}

async function claimSchedule(schedule: AutoPostSchedule, now: Date, force: boolean) {
  const claimedUntil = new Date(now.getTime() + AUTO_POST_CLAIM_LOCK_MS)
  const result = await prisma.autoPostSchedule.updateMany({
    where: force
      ? {
        id: schedule.id,
        OR: [
          { lastRunMessage: { not: AUTO_POST_RUNNING_MESSAGE } },
          { nextRunAt: { lte: now } },
        ],
      }
      : {
        id: schedule.id,
        enabled: true,
        nextRunAt: { lte: now },
      },
    data: {
      nextRunAt: claimedUntil,
      lastRunMessage: AUTO_POST_RUNNING_MESSAGE,
    },
  })

  return result.count > 0
}

async function runSingleSchedule(
  schedule: AutoPostSchedule,
  options: { force?: boolean; topicId?: string | null; trigger?: string } = {}
): Promise<AutoPostRunResult> {
  const now = new Date()
  const startedAt = now
  if (!options.force && (!schedule.enabled || schedule.nextRunAt > now)) {
    return {
      scheduleId: schedule.id,
      scheduleName: schedule.name,
      scope: schedule.scope,
      topicId: null,
      topicTitle: '',
      createdRoots: 0,
      createdReplies: 0,
      blockedCount: 0,
      skippedCount: 1,
      failedCount: 0,
      fallbackCount: 0,
      providerStatus: getAiProviderStatus().configured ? 'configured' : 'template',
      message: '未到执行时间',
      nextRunAt: schedule.nextRunAt,
    }
  }

  const nowMs = Date.now()
  const AUTO_POST_TOPICS_PER_RUN = 2
  const topics = await pickRunTopics(options.topicId, AUTO_POST_TOPICS_PER_RUN, nowMs + schedule.lastRunCount)
  const primaryTopic = topics[0]
  const topicTitle = topics.map((item) => item.title).join(' / ')
  const bots = await getBalancedBots(schedule.scope, schedule.postsPerRun)
  const allReplyBots = await prisma.user.findMany({
    where: getScopeWhere(schedule.scope),
    select: { id: true, name: true, handle: true, bio: true, category: true, quote: true },
    orderBy: { handle: 'asc' },
  })

  let createdRoots = 0
  let createdReplies = 0
  let blockedCount = 0
  let skippedCount = 0
  let failedCount = 0
  let fallbackCount = 0
  let modelCount = 0
  let lastError = ''
  const model = getAiProviderStatus().model

  if (!primaryTopic || bots.length === 0) {
    const nextRunAt = new Date(nowMs + schedule.intervalMinutes * 60 * 1000)
    const message = !primaryTopic ? '没有可用话题，已跳过本轮' : '没有可用 Bot，已跳过本轮'
    skippedCount = 1
    await prisma.autoPostSchedule.update({
      where: { id: schedule.id },
      data: { lastRunAt: now, nextRunAt, lastRunCount: 0, lastRunMessage: message },
    })
    await prisma.autoPostRunLog.create({
      data: {
        scheduleId: schedule.id,
        topicId: primaryTopic?.id || null,
        topicTitle: topicTitle || '',
        trigger: options.trigger || 'cron',
        providerStatus: getAiProviderStatus().configured ? 'configured' : 'template',
        model,
        failedCount: 1,
        message,
        startedAt,
        completedAt: new Date(),
      },
    })
    return {
      scheduleId: schedule.id,
      scheduleName: schedule.name,
      scope: schedule.scope,
      topicId: primaryTopic?.id || null,
      topicTitle: topicTitle || '',
      createdRoots,
      createdReplies,
      blockedCount,
      skippedCount,
      failedCount: 1,
      fallbackCount,
      providerStatus: getAiProviderStatus().configured ? 'configured' : 'template',
      message,
      nextRunAt,
    }
  }

  for (let index = 0; index < bots.length; index += 1) {
    const bot = bots[index]
    const seed = Math.floor(nowMs / 60000) + index * 17 + schedule.lastRunCount
    const topic = topics[index % topics.length] || primaryTopic
    const fallback = fallbackPost(bot, topic, seed)
    const generated = await generatePostContent(bot, topic, seed)
    if (generated.source === 'template') fallbackCount += 1
    if (generated.source === 'model') modelCount += 1
    if (generated.error) lastError = generated.error

    const visible = await visibleAutoText(generated, fallback, {
      scheduleId: schedule.id,
      topicId: topic.id,
      kind: 'root',
      botId: bot.id,
    })
    if (!visible.ok) {
      blockedCount += 1
      failedCount += 1
      lastError = visible.error || 'CONTENT_BLOCKED'
      continue
    }
    if (visible.source === 'template' && generated.source === 'model') fallbackCount += 1

    const content = await ensureUniqueContent(bot.id, visible.content, seed)
    const root = await prisma.tweet.create({
      data: {
        authorId: bot.id,
        content,
        category: topic.category || '讨论',
        topicId: topic.id,
        likesCount: randomInt(2, 18),
        retweetsCount: randomInt(0, 7),
        viewsCount: randomInt(80, 520),
        tipsCount: 0,
      },
    })
    createdRoots += 1

    const target: ReplyTarget = { id: root.id, content, author: bot }
    const replyBots = pickReplyBots(allReplyBots, target, schedule.repliesPerPost, seed)
    const usedAuthorIds = new Set<string>()
    let previousTurn: DebateTurn | undefined

    for (let replyIndex = 0; replyIndex < schedule.repliesPerPost; replyIndex += 1) {
      const shouldDebate = replyIndex >= 2 || (replyIndex >= 1 && seed % 3 === 0)
      const replier = pickNextReplyBot(
        replyBots,
        allReplyBots,
        target,
        shouldDebate ? previousTurn : undefined,
        usedAuthorIds,
        seed + replyIndex * 23,
        true
      )
      if (!replier) break
      const replyStats = await createReplyForTarget(
        schedule.id,
        topic,
        target,
        replier,
        seed + replyIndex * 23,
        shouldDebate ? previousTurn : undefined
      )
      createdReplies += replyStats.createdReplies
      blockedCount += replyStats.blockedCount
      failedCount += replyStats.failedCount
      fallbackCount += replyStats.fallbackCount
      modelCount += replyStats.modelCount
      if (replyStats.lastError) lastError = replyStats.lastError
      if (replyStats.tweetId && replyStats.author && replyStats.content) {
        previousTurn = { id: replyStats.tweetId, author: replyStats.author, content: replyStats.content }
        usedAuthorIds.add(replyStats.author.id)
      }
    }

    await refreshConversationReplyCount(root.id)
  }

  const catchUpStats = await catchUpRecentRootReplies(schedule, primaryTopic, allReplyBots, nowMs + schedule.lastRunCount * 97)
  createdReplies += catchUpStats.createdReplies
  blockedCount += catchUpStats.blockedCount
  failedCount += catchUpStats.failedCount
  fallbackCount += catchUpStats.fallbackCount
  modelCount += catchUpStats.modelCount
  if (catchUpStats.lastError) lastError = catchUpStats.lastError

  if (createdRoots === 0 && blockedCount === 0) skippedCount += 1

  const nextRunAt = new Date(nowMs + schedule.intervalMinutes * 60 * 1000)
  const providerStatus = providerStatusLabel(fallbackCount, modelCount, failedCount)
  const message = blockedCount > 0
    ? `话题「${topicTitle}」已发布 ${createdRoots} 条主贴、${createdReplies} 条回复，审查拦截 ${blockedCount} 条`
    : `话题「${topicTitle}」已发布 ${createdRoots} 条主贴、${createdReplies} 条回复`

  await prisma.autoPostSchedule.update({
    where: { id: schedule.id },
    data: {
      lastRunAt: now,
      nextRunAt,
      lastRunCount: createdRoots + createdReplies,
      lastRunMessage: message,
    },
  })
  await prisma.autoPostTopic.updateMany({
    where: { id: { in: topics.map((topic) => topic.id) } },
    data: { lastUsedAt: now },
  })
  await prisma.autoPostRunLog.create({
    data: {
      scheduleId: schedule.id,
      topicId: primaryTopic.id,
      topicTitle,
      trigger: options.trigger || 'cron',
      providerStatus,
      model,
      createdRoots,
      createdReplies,
      blockedCount,
      failedCount,
      fallbackCount,
      message,
      error: lastError,
      startedAt,
      completedAt: new Date(),
    },
  })

  return {
    scheduleId: schedule.id,
    scheduleName: schedule.name,
    scope: schedule.scope,
    topicId: primaryTopic.id,
    topicTitle,
    createdRoots,
    createdReplies,
    blockedCount,
    skippedCount,
    failedCount,
    fallbackCount,
    providerStatus,
    message,
    nextRunAt,
  }
}

export async function runDueAutoPostSchedules(options: { force?: boolean; topicId?: string | null; trigger?: string } = {}) {
  const force = Boolean(options.force)
  const defaultSchedule = await getOrCreateAutoPostSchedule()
  const now = new Date()
  const dueSchedules = force
    ? [defaultSchedule]
    : await prisma.autoPostSchedule.findMany({
      where: { enabled: true, nextRunAt: { lte: now } },
      orderBy: { nextRunAt: 'asc' },
    })
  const dailyKickoff = !force && dueSchedules.length === 0 && await shouldKickoffDailyTopics(defaultSchedule, now)
  const schedules = dailyKickoff ? [defaultSchedule] : dueSchedules

  const results: AutoPostRunResult[] = []
  for (const schedule of schedules) {
    const claimed = await claimSchedule(schedule, now, force || dailyKickoff)
    if (!claimed) {
      results.push(skippedRunResult(schedule, '已有自动发帖任务正在执行，已跳过本次触发'))
      continue
    }

    results.push(await runSingleSchedule(schedule, {
      force: force || dailyKickoff,
      topicId: options.topicId,
      trigger: options.trigger || (force ? 'admin' : dailyKickoff ? 'daily-topic-kickoff' : 'cron'),
    }))
  }

  return {
    ran: results.length,
    createdRoots: results.reduce((sum, item) => sum + item.createdRoots, 0),
    createdReplies: results.reduce((sum, item) => sum + item.createdReplies, 0),
    blockedCount: results.reduce((sum, item) => sum + item.blockedCount, 0),
    skippedCount: results.reduce((sum, item) => sum + item.skippedCount, 0),
    failedCount: results.reduce((sum, item) => sum + item.failedCount, 0),
    fallbackCount: results.reduce((sum, item) => sum + item.fallbackCount, 0),
    results,
  }
}
