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

    const commands = await prisma.command.findMany({
      where: { botId: auth.bot.id, status: 'pending' },
      orderBy: { createdAt: 'asc' },
      take: 20,
    })

    return corsJson({
      commands: commands.map((c) => ({
        id: c.id,
        type: c.type,
        payload: c.payload,
        status: c.status,
        createdAt: c.createdAt.toISOString(),
      })),
    }, {}, request, 'GET, OPTIONS')
  } catch (error) {
    console.error('Bot get commands error:', error)
    return corsJson({ error: '获取指令失败' }, { status: 500 }, request, 'GET, OPTIONS')
  }
}
