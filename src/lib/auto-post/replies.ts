import { prisma } from '@/lib/db'
import { moderatePostContent, logModerationBlock } from '@/lib/moderation'
import type { AiTextResult } from '@/lib/ai'
import type { BotPersona, ReplyTarget, ReplyCreationStats, DebateTurn } from './types'
import { AUTO_POST_RECENT_ROOT_HOURS, AUTO_POST_RECENT_ROOT_LIMIT, AUTO_POST_CATCH_UP_REPLY_LIMIT } from './types'
import type { AutoPostSchedule, AutoPostTopic } from '@/generated/prisma/client'
import { generateReplyContent, generateDebateReplyContent, fallbackDebateReply, fallbackReply } from './generation'
import { getScopeWhere, trimTweet, contentMentionsHandle, randomInt } from './utils'

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

async function refreshDirectReplyCount(tweetId: string) {
  await prisma.tweet.update({
    where: { id: tweetId },
    data: { repliesCount: await prisma.tweet.count({ where: { replyToId: tweetId } }) },
  })
}

async function refreshConversationReplyCount(rootId: string) {
  const replies = await getDescendantReplies(rootId)
  await prisma.tweet.update({
    where: { id: rootId },
    data: { repliesCount: replies.length },
  })
}

export async function getDescendantReplies(rootId: string, maxDepth = 6) {
  const replies: Array<{
    id: string
    authorId: string
    content: string
    createdAt: Date
    author: BotPersona
  }> = []
  let frontier = [rootId]
  for (let depth = 0; depth < maxDepth && frontier.length > 0; depth += 1) {
    const batch = await prisma.tweet.findMany({
      where: { replyToId: { in: frontier } },
      select: {
        id: true,
        authorId: true,
        content: true,
        createdAt: true,
        author: { select: { id: true, name: true, handle: true, bio: true, category: true, quote: true } },
      },
      orderBy: { createdAt: 'asc' },
    })
    replies.push(...batch)
    frontier = batch.map((reply) => reply.id)
  }
  return replies
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

export function pickReplyBots(
  allReplyBots: BotPersona[],
  target: ReplyTarget,
  limit: number,
  seed: number,
  excludedAuthorIds = new Set<string>()
) {
  if (limit <= 0) return []
  return allReplyBots
    .filter((candidate) => candidate.id !== target.author.id && !excludedAuthorIds.has(candidate.id))
    .map((candidate, candidateIndex) => ({ candidate, score: Math.abs(seed + candidateIndex * 37) % 997 }))
    .sort((a, b) => a.score - b.score || a.candidate.handle.localeCompare(b.candidate.handle))
    .slice(0, limit)
    .map((item) => item.candidate)
}

export function pickNextReplyBot(
  plannedBots: BotPersona[],
  allReplyBots: BotPersona[],
  target: ReplyTarget,
  previousTurn: DebateTurn | undefined,
  usedAuthorIds: Set<string>,
  seed: number,
  allowRootAuthorReply: boolean
) {
  if (
    allowRootAuthorReply &&
    previousTurn &&
    previousTurn.author.id !== target.author.id &&
    !usedAuthorIds.has(target.author.id) &&
    contentMentionsHandle(previousTurn.content, target.author.handle)
  ) {
    return target.author
  }

  const plannedIndex = plannedBots.findIndex((bot) => bot.id !== previousTurn?.author.id && !usedAuthorIds.has(bot.id))
  if (plannedIndex >= 0) {
    const [bot] = plannedBots.splice(plannedIndex, 1)
    return bot
  }

  const fallback = allReplyBots
    .filter((bot) => bot.id !== previousTurn?.author.id && bot.id !== target.author.id && !usedAuthorIds.has(bot.id))
    .map((bot, index) => ({ bot, score: Math.abs(seed + index * 53) % 997 }))
    .sort((a, b) => a.score - b.score || a.bot.handle.localeCompare(b.bot.handle))[0]

  return fallback?.bot
}

export async function createReplyForTarget(
  scheduleId: string,
  topic: AutoPostTopic,
  target: ReplyTarget,
  replier: BotPersona,
  seed: number,
  previousTurn?: DebateTurn
): Promise<ReplyCreationStats> {
  const parentId = previousTurn?.id || target.id
  const replyFallback = previousTurn
    ? fallbackDebateReply(replier, target.author, previousTurn.author, previousTurn.content, seed)
    : fallbackReply(replier, target.author, target.content, seed)
  const replyGenerated = previousTurn
    ? await generateDebateReplyContent(replier, target.author, previousTurn.author, topic, target.content, previousTurn.content, seed)
    : await generateReplyContent(replier, target.author, topic, target.content, seed)
  let fallbackCount = replyGenerated.source === 'template' ? 1 : 0
  const modelCount = replyGenerated.source === 'model' ? 1 : 0
  const lastError = replyGenerated.error || ''

  const visibleReply = await visibleAutoText(replyGenerated, replyFallback, {
    scheduleId,
    topicId: topic.id,
    kind: 'reply',
    botId: replier.id,
    replyToId: parentId,
  })
  if (!visibleReply.ok) {
    return {
      createdReplies: 0,
      blockedCount: 1,
      failedCount: 1,
      fallbackCount,
      modelCount,
      lastError: visibleReply.error || lastError || 'CONTENT_BLOCKED',
    }
  }
  if (visibleReply.source === 'template' && replyGenerated.source === 'model') fallbackCount += 1
  const finalContent = await ensureUniqueContent(replier.id, visibleReply.content, seed)

  const created = await prisma.tweet.create({
    data: {
      authorId: replier.id,
      content: finalContent,
      category: topic.category || '讨论',
      topicId: topic.id,
      replyToId: parentId,
      likesCount: randomInt(0, 10),
      retweetsCount: randomInt(0, 4),
      viewsCount: randomInt(40, 240),
      tipsCount: 0,
    },
  })
  await refreshDirectReplyCount(parentId)

  return {
    createdReplies: 1,
    blockedCount: 0,
    failedCount: 0,
    fallbackCount,
    modelCount,
    lastError,
    tweetId: created.id,
    content: finalContent,
    author: replier,
  }
}

export function addReplyStats(target: ReplyCreationStats, addition: ReplyCreationStats) {
  target.createdReplies += addition.createdReplies
  target.blockedCount += addition.blockedCount
  target.failedCount += addition.failedCount
  target.fallbackCount += addition.fallbackCount
  target.modelCount += addition.modelCount
  if (addition.lastError) target.lastError = addition.lastError
}

export async function catchUpRecentRootReplies(
  schedule: AutoPostSchedule,
  topic: AutoPostTopic,
  allReplyBots: BotPersona[],
  seedBase: number
): Promise<ReplyCreationStats> {
  const stats: ReplyCreationStats = {
    createdReplies: 0,
    blockedCount: 0,
    failedCount: 0,
    fallbackCount: 0,
    modelCount: 0,
    lastError: '',
  }
  if (schedule.repliesPerPost <= 0 || allReplyBots.length < 2) return stats

  const since = new Date(Date.now() - AUTO_POST_RECENT_ROOT_HOURS * 60 * 60 * 1000)
  const roots = await prisma.tweet.findMany({
    where: {
      replyToId: null,
      topicId: topic.id,
      createdAt: { gte: since },
      author: getScopeWhere(schedule.scope),
    },
    select: {
      id: true,
      content: true,
      repliesCount: true,
      author: { select: { id: true, name: true, handle: true, bio: true, category: true, quote: true } },
    },
    orderBy: [{ repliesCount: 'asc' }, { createdAt: 'desc' }],
    take: AUTO_POST_RECENT_ROOT_LIMIT,
  })

  for (const root of roots) {
    if (stats.createdReplies >= AUTO_POST_CATCH_UP_REPLY_LIMIT) break

    const existingReplies = await getDescendantReplies(root.id)
    const gap = schedule.repliesPerPost - existingReplies.length
    if (gap <= 0) {
      if (root.repliesCount !== existingReplies.length) await refreshConversationReplyCount(root.id)
      continue
    }

    const excludedAuthorIds = new Set(existingReplies.map((reply) => reply.authorId))
    const target: ReplyTarget = { id: root.id, content: root.content, author: root.author }
    const limit = Math.min(gap, AUTO_POST_CATCH_UP_REPLY_LIMIT - stats.createdReplies)
    const replyBots = pickReplyBots(allReplyBots, target, limit, seedBase + stats.createdReplies * 41, excludedAuthorIds)
    const usedAuthorIds = new Set(excludedAuthorIds)
    let previousTurn: DebateTurn | undefined = existingReplies.length > 0
      ? {
        id: existingReplies[existingReplies.length - 1].id,
        author: existingReplies[existingReplies.length - 1].author,
        content: existingReplies[existingReplies.length - 1].content,
      }
      : undefined

    for (let replyIndex = 0; replyIndex < limit; replyIndex += 1) {
      const replier = pickNextReplyBot(
        replyBots,
        allReplyBots,
        target,
        previousTurn,
        usedAuthorIds,
        seedBase + stats.createdReplies * 53 + replyIndex * 17,
        true
      )
      if (!replier) break
      const replyStats = await createReplyForTarget(
        schedule.id,
        topic,
        target,
        replier,
        seedBase + stats.createdReplies * 53 + replyIndex * 17,
        previousTurn
      )
      addReplyStats(stats, replyStats)
      if (replyStats.tweetId && replyStats.author && replyStats.content) {
        previousTurn = { id: replyStats.tweetId, author: replyStats.author, content: replyStats.content }
        usedAuthorIds.add(replyStats.author.id)
      }
    }

    await refreshConversationReplyCount(root.id)
  }

  return stats
}
