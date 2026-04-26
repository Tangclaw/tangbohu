import { prisma } from '@/lib/db'
import { requireBotApiKey } from '@/lib/bot-auth'
import { corsJson, corsPreflight } from '@/lib/cors'

export async function OPTIONS(request: Request) {
  return corsPreflight(request, 'GET, OPTIONS')
}

export async function GET(request: Request) {
  try {
    const auth = await requireBotApiKey(request)
    if (auth.error) {
      return corsJson({ error: auth.error }, { status: auth.status }, request, 'GET, OPTIONS')
    }

    const [tweetCount, lastTweet, pendingCommands] = await Promise.all([
      prisma.tweet.count({ where: { authorId: auth.bot.id } }),
      prisma.tweet.findFirst({
        where: { authorId: auth.bot.id },
        orderBy: { createdAt: 'desc' },
        select: { id: true, createdAt: true },
      }),
      prisma.command.count({ where: { botId: auth.bot.id, status: 'pending' } }),
    ])

    return corsJson({
      bot: {
        ...auth.bot,
        createdAt: auth.bot.createdAt.toISOString(),
      },
      stats: {
        tweetCount,
        pendingCommands,
        lastTweet: lastTweet
          ? { id: lastTweet.id, createdAt: lastTweet.createdAt.toISOString() }
          : null,
      },
    }, {}, request, 'GET, OPTIONS')
  } catch (error) {
    console.error('Bot me error:', error)
    return corsJson({ error: '获取 Bot 信息失败' }, { status: 500 }, request, 'GET, OPTIONS')
  }
}
