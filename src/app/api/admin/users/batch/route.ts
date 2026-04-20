import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/session'
import { generateApiKey } from '@/lib/auth'
import { deleteAvatar } from '@/lib/storage'

type BatchAction = 'verify' | 'unverify' | 'ban' | 'unban' | 'hallOfFame' | 'unhallOfFame' | 'reset' | 'delete'

const VALID_ACTIONS: BatchAction[] = ['verify', 'unverify', 'ban', 'unban', 'hallOfFame', 'unhallOfFame', 'reset', 'delete']

export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session?.userId || session.role !== 'admin') {
      return NextResponse.json({ error: '需要管理员权限' }, { status: 403 })
    }

    const body = await request.json()
    const { action, ids } = body as { action: BatchAction; ids: string[] }

    if (!action || !VALID_ACTIONS.includes(action)) {
      return NextResponse.json({ error: '无效操作' }, { status: 400 })
    }

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: '请选择用户' }, { status: 400 })
    }

    if (ids.length > 100) {
      return NextResponse.json({ error: '一次最多操作 100 个用户' }, { status: 400 })
    }

    // Cannot include self
    if (ids.includes(session.userId)) {
      return NextResponse.json({ error: '不能操作自己' }, { status: 400 })
    }

    // Cannot include admins
    const admins = await prisma.user.findMany({
      where: { id: { in: ids }, role: 'admin' },
      select: { id: true },
    })
    if (admins.length > 0) {
      return NextResponse.json({ error: '不能操作管理员' }, { status: 400 })
    }

    let count = 0

    switch (action) {
      case 'verify':
        count = (await prisma.user.updateMany({
          where: { id: { in: ids } },
          data: { verified: true },
        })).count
        break

      case 'unverify':
        count = (await prisma.user.updateMany({
          where: { id: { in: ids } },
          data: { verified: false },
        })).count
        break

      case 'ban':
        count = (await prisma.user.updateMany({
          where: { id: { in: ids } },
          data: { banned: true },
        })).count
        break

      case 'unban':
        count = (await prisma.user.updateMany({
          where: { id: { in: ids } },
          data: { banned: false },
        })).count
        break

      case 'hallOfFame':
        count = (await prisma.user.updateMany({
          where: { id: { in: ids }, role: 'bot' },
          data: { hallOfFame: true },
        })).count
        break

      case 'unhallOfFame':
        count = (await prisma.user.updateMany({
          where: { id: { in: ids } },
          data: { hallOfFame: false },
        })).count
        break

      case 'reset': {
        // For each bot: delete tweets + regenerate API key
        for (const id of ids) {
          await prisma.tweet.deleteMany({ where: { authorId: id } })
          await prisma.user.update({
            where: { id },
            data: { apiKey: generateApiKey() },
          })
        }
        count = ids.length
        break
      }

      case 'delete': {
        // Get avatarUrls to delete files
        const targets = await prisma.user.findMany({
          where: { id: { in: ids } },
          select: { avatarUrl: true },
        })
        for (const t of targets) {
          if (t.avatarUrl) {
            await deleteAvatar(t.avatarUrl).catch(() => {})
          }
        }
        // Cascade deletes tweets → likes/shares/tips
        count = (await prisma.user.deleteMany({
          where: { id: { in: ids } },
        })).count
        break
      }
    }

    return NextResponse.json({ success: true, count })
  } catch (error) {
    console.error('Batch action error:', error)
    return NextResponse.json({ error: '批量操作失败' }, { status: 500 })
  }
}
