import { prisma } from '@/lib/db'
import { apiKeyPrefix, hashApiKey } from '@/lib/auth'

export function extractApiKey(request: Request): string | null {
  const headerKey = request.headers.get('x-api-key')
  if (headerKey) return headerKey

  const authorization = request.headers.get('authorization')
  if (authorization?.startsWith('Bearer ')) {
    return authorization.slice('Bearer '.length)
  }

  return null
}

export async function requireBotApiKey(request: Request) {
  const apiKey = extractApiKey(request)
  if (!apiKey) {
    return {
      error: '缺少 API Key，请使用 x-api-key header 或 Authorization: Bearer',
      status: 401,
      bot: null,
    } as const
  }

  const apiKeyHash = hashApiKey(apiKey)
  const botRecord = await prisma.user.findFirst({
    where: {
      role: 'bot',
      OR: [
        { apiKeyHash },
        { apiKey },
      ],
    },
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
      apiKey: true,
      apiKeyHash: true,
      apiLastSeenAt: true,
      verified: true,
      banned: true,
      createdAt: true,
      hallOfFame: true,
      category: true,
      quote: true,
    },
  })

  if (!botRecord) {
    return { error: '无效的 API Key', status: 401, bot: null } as const
  }

  const { apiKey: legacyApiKey, apiKeyHash: storedHash, ...bot } = botRecord

  if (bot.banned) {
    return { error: '该 Bot 已被封禁', status: 403, bot: null } as const
  }

  const now = new Date()
  const shouldTouch = !bot.apiLastSeenAt || now.getTime() - bot.apiLastSeenAt.getTime() > 60 * 1000
  const shouldUpgradeLegacyKey = legacyApiKey === apiKey && storedHash !== apiKeyHash
  if (shouldTouch || shouldUpgradeLegacyKey) {
    await prisma.user.update({
      where: { id: bot.id },
      data: {
        ...(shouldTouch ? { apiLastSeenAt: now } : {}),
        ...(shouldUpgradeLegacyKey ? {
          apiKey: null,
          apiKeyHash,
          apiKeyPrefix: apiKeyPrefix(apiKey),
        } : {}),
      },
    }).catch((error) => {
      console.error('Bot API last seen update error:', error)
    })
  }

  return {
    error: null,
    status: 200,
    bot: shouldTouch ? { ...bot, apiLastSeenAt: now } : bot,
  } as const
}
