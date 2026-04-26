import { AUTHOR_SELECT, prisma } from '@/lib/db'
import { isPostContentVisible } from '@/lib/moderation'

export type ReplyPreviewItem = {
  id: string
  content: string
  category: string
  author: {
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
    hallOfFame: boolean
    createdAt: Date
  }
  createdAt: string
  likesCount: number
  retweetsCount: number
  repliesCount: number
  viewsCount: number
  tipsCount: number
  replyToId: string | null
  replyToHandle: string | null
  replyDepth: number
}

export async function getReplyPreviewMap(tweetIds: string[], limit = 2): Promise<Map<string, ReplyPreviewItem[]>> {
  if (tweetIds.length === 0 || limit <= 0) return new Map()

  const directReplies = await prisma.tweet.findMany({
    where: { replyToId: { in: tweetIds } },
    include: {
      author: {
        select: { ...AUTHOR_SELECT, createdAt: true },
      },
      replyTo: { select: { id: true, author: { select: { handle: true } } } },
    },
    orderBy: { createdAt: 'asc' },
  })
  const directReplyParent = new Map(directReplies.map((reply) => [reply.id, reply.replyToId || '']))
  const childReplies = directReplies.length === 0 ? [] : await prisma.tweet.findMany({
    where: { replyToId: { in: directReplies.map((reply) => reply.id) } },
    include: {
      author: {
        select: { ...AUTHOR_SELECT, createdAt: true },
      },
      replyTo: { select: { id: true, author: { select: { handle: true } } } },
    },
    orderBy: { createdAt: 'asc' },
  })

  type ReplyPreviewRow = (typeof directReplies)[number] & { previewDepth: number }
  const repliesByTweet = new Map<string, ReplyPreviewRow[]>()
  const pushPreview = (tweetId: string, reply: (typeof directReplies)[number], previewDepth: number) => {
    const group = repliesByTweet.get(tweetId) || []
    if (group.length < limit && isPostContentVisible(reply.content)) {
      group.push({ ...reply, previewDepth })
      repliesByTweet.set(tweetId, group)
    }
  }

  for (const reply of directReplies) {
    pushPreview(reply.replyToId || '', reply, 0)
  }
  for (const reply of childReplies) {
    const rootId = directReplyParent.get(reply.replyToId || '')
    if (rootId) pushPreview(rootId, reply, 1)
  }

  const formatted = new Map<string, ReplyPreviewItem[]>()

  for (const [tweetId, replies] of repliesByTweet) {
    formatted.set(tweetId, replies.map((reply) => ({
      id: reply.id,
      content: reply.content,
      category: reply.category,
      author: reply.author,
      createdAt: reply.createdAt.toISOString(),
      likesCount: reply.likesCount,
      retweetsCount: reply.retweetsCount,
      repliesCount: reply.repliesCount,
      viewsCount: reply.viewsCount,
      tipsCount: reply.tipsCount,
      replyToId: reply.replyToId,
      replyToHandle: reply.replyTo?.author?.handle || null,
      replyDepth: reply.previewDepth,
    })))
  }

  return formatted
}
