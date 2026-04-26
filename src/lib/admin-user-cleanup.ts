import { prisma } from '@/lib/db'
import { deleteAvatar, deleteCover } from '@/lib/storage'

type CleanupClient = Pick<typeof prisma, 'command' | 'like' | 'share' | 'tip' | 'tweet' | 'user'>

function addCount(map: Map<string, number>, key: string, amount = 1) {
  map.set(key, (map.get(key) || 0) + amount)
}

async function cleanupUserRelations(tx: CleanupClient, userId: string) {
  const authoredTweets = await tx.tweet.findMany({
    where: { authorId: userId },
    select: { id: true, replyToId: true },
  })
  const authoredTweetIds = new Set(authoredTweets.map((tweet) => tweet.id))

  const [likes, shares, tips] = await Promise.all([
    tx.like.findMany({ where: { userId }, select: { tweetId: true } }),
    tx.share.findMany({ where: { userId }, select: { tweetId: true } }),
    tx.tip.findMany({ where: { userId }, select: { tweetId: true, amount: true } }),
  ])

  const likeCounts = new Map<string, number>()
  const shareCounts = new Map<string, number>()
  const tipCounts = new Map<string, number>()
  const replyCounts = new Map<string, number>()

  for (const like of likes) {
    if (!authoredTweetIds.has(like.tweetId)) addCount(likeCounts, like.tweetId)
  }
  for (const share of shares) {
    if (!authoredTweetIds.has(share.tweetId)) addCount(shareCounts, share.tweetId)
  }
  for (const tip of tips) {
    if (!authoredTweetIds.has(tip.tweetId)) addCount(tipCounts, tip.tweetId, tip.amount)
  }
  for (const tweet of authoredTweets) {
    if (tweet.replyToId && !authoredTweetIds.has(tweet.replyToId)) {
      addCount(replyCounts, tweet.replyToId)
    }
  }

  await tx.like.deleteMany({ where: { userId } })
  await tx.share.deleteMany({ where: { userId } })
  await tx.tip.deleteMany({ where: { userId } })
  await tx.command.deleteMany({ where: { botId: userId } })
  await tx.tweet.deleteMany({ where: { authorId: userId } })

  for (const [tweetId, count] of likeCounts) {
    await tx.tweet.updateMany({ where: { id: tweetId }, data: { likesCount: { decrement: count } } })
  }
  for (const [tweetId, count] of shareCounts) {
    await tx.tweet.updateMany({ where: { id: tweetId }, data: { retweetsCount: { decrement: count } } })
  }
  for (const [tweetId, count] of tipCounts) {
    await tx.tweet.updateMany({ where: { id: tweetId }, data: { tipsCount: { decrement: count } } })
  }
  for (const [tweetId, count] of replyCounts) {
    await tx.tweet.updateMany({ where: { id: tweetId }, data: { repliesCount: { decrement: count } } })
  }
}

export async function deleteUsersForAdmin(userIds: string[]) {
  const uniqueIds = Array.from(new Set(userIds))
  if (uniqueIds.length === 0) return 0

  const targets = await prisma.user.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true, avatarUrl: true, coverUrl: true },
  })
  const targetIds = targets.map((target) => target.id)
  const avatarUrls = targets
    .map((target) => target.avatarUrl)
    .filter((url): url is string => Boolean(url))
  const coverUrls = targets
    .map((target) => target.coverUrl)
    .filter((url): url is string => Boolean(url))

  if (targetIds.length === 0) return 0

  const count = await prisma.$transaction(async (tx) => {
    for (const id of targetIds) {
      await cleanupUserRelations(tx, id)
    }

    const result = await tx.user.deleteMany({
      where: { id: { in: targetIds } },
    })
    return result.count
  })

  await Promise.all(avatarUrls.map((url) => deleteAvatar(url).catch(() => {})))
  await Promise.all(coverUrls.map((url) => deleteCover(url).catch(() => {})))

  return count
}

export async function resetBotForAdmin(botId: string) {
  await prisma.$transaction(async (tx) => {
    await cleanupUserRelations(tx, botId)
  })
}
