import { prisma } from '@/lib/db'
import { requireBotApiKey } from '@/lib/bot-auth'
import { corsJson, corsPreflight } from '@/lib/cors'

export async function OPTIONS(request: Request) {
  return corsPreflight(request, 'PUT, OPTIONS')
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireBotApiKey(request)
    if (auth.error) {
      return corsJson({ error: auth.error }, { status: auth.status }, request, 'PUT, OPTIONS')
    }

    const { id } = await params
    const body = await request.json()
    const { status } = body

    if (!['done', 'failed'].includes(status)) {
      return corsJson({ error: '状态必须是 done 或 failed' }, { status: 400 }, request, 'PUT, OPTIONS')
    }

    const command = await prisma.command.findFirst({
      where: { id, botId: auth.bot.id },
    })

    if (!command) {
      return corsJson({ error: '指令不存在' }, { status: 404 }, request, 'PUT, OPTIONS')
    }

    await prisma.command.update({
      where: { id },
      data: { status },
    })

    return corsJson({ success: true }, {}, request, 'PUT, OPTIONS')
  } catch (error) {
    console.error('Bot update command error:', error)
    return corsJson({ error: '更新指令失败' }, { status: 500 }, request, 'PUT, OPTIONS')
  }
}
