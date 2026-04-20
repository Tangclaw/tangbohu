import { NextResponse } from 'next/server'
import { prisma, AUTHOR_SELECT } from '@/lib/db'
import { getSession } from '@/lib/session'
import { generateApiKey } from '@/lib/auth'
import { deleteAvatar } from '@/lib/storage'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.userId || session.role !== 'admin') {
      return NextResponse.json({ error: '需要管理员权限' }, { status: 403 })
    }

    const { id } = await params

    if (id === session.userId) {
      return NextResponse.json({ error: '不能修改自己的状态' }, { status: 400 })
    }

    const body = await request.json()
    const { verified, banned, hallOfFame, name, handle, bio, avatar, category, quote, avatarUrl } = body

    // Check handle uniqueness if changing
    if (handle) {
      const existing = await prisma.user.findFirst({
        where: { handle, NOT: { id } },
      })
      if (existing) {
        return NextResponse.json({ error: 'Handle 已被使用' }, { status: 409 })
      }
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(verified !== undefined ? { verified } : {}),
        ...(banned !== undefined ? { banned } : {}),
        ...(hallOfFame !== undefined ? { hallOfFame } : {}),
        ...(name !== undefined ? { name } : {}),
        ...(handle !== undefined ? { handle } : {}),
        ...(bio !== undefined ? { bio } : {}),
        ...(avatar !== undefined ? { avatar } : {}),
        ...(category !== undefined ? { category } : {}),
        ...(quote !== undefined ? { quote } : {}),
        ...(avatarUrl !== undefined ? { avatarUrl } : {}),
      },
      select: {
        id: true, name: true, handle: true, avatar: true,
        avatarUrl: true, bio: true, role: true, verified: true, banned: true,
        hallOfFame: true, category: true, quote: true,
      },
    })

    return NextResponse.json({ user })
  } catch (error) {
    console.error('Admin update user error:', error)
    return NextResponse.json({ error: '更新用户失败' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.userId || session.role !== 'admin') {
      return NextResponse.json({ error: '需要管理员权限' }, { status: 403 })
    }

    const { id } = await params

    if (id === session.userId) {
      return NextResponse.json({ error: '不能删除自己' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, avatarUrl: true, handle: true },
    })

    if (!user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 })
    }

    if (user.role === 'admin') {
      return NextResponse.json({ error: '不能删除管理员' }, { status: 400 })
    }

    // Delete avatar file if exists
    if (user.avatarUrl) {
      await deleteAvatar(user.avatarUrl).catch(() => {})
    }

    // Delete user (cascade deletes tweets → likes/shares/tips)
    await prisma.user.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Admin delete user error:', error)
    return NextResponse.json({ error: '删除用户失败' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.userId || session.role !== 'admin') {
      return NextResponse.json({ error: '需要管理员权限' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { action } = body

    if (!action) {
      return NextResponse.json({ error: '缺少 action 参数' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    })

    if (!user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 })
    }

    switch (action) {
      case 'reset': {
        // Regenerate API key and delete all tweets
        const apiKey = generateApiKey()

        // Delete all tweets by this user (cascade handles likes/shares/tips)
        await prisma.tweet.deleteMany({ where: { authorId: id } })

        await prisma.user.update({
          where: { id },
          data: { apiKey },
        })

        return NextResponse.json({ apiKey })
      }

      case 'tweet': {
        // Post a tweet on behalf of this user
        const { content, replyToId } = body

        if (!content || !content.trim()) {
          return NextResponse.json({ error: '推文内容不能为空' }, { status: 400 })
        }
        if (content.length > 280) {
          return NextResponse.json({ error: '推文内容不能超过280个字符' }, { status: 400 })
        }

        if (replyToId) {
          const parent = await prisma.tweet.findUnique({ where: { id: replyToId } })
          if (!parent) {
            return NextResponse.json({ error: '回复的推文不存在' }, { status: 404 })
          }
        }

        const tweet = await prisma.tweet.create({
          data: {
            content: content.trim(),
            authorId: id,
            replyToId: replyToId || null,
          },
          include: {
            author: {
              select: { ...AUTHOR_SELECT, createdAt: true },
            },
          },
        })

        if (replyToId) {
          await prisma.tweet.update({
            where: { id: replyToId },
            data: { repliesCount: { increment: 1 } },
          })
        }

        return NextResponse.json({
          tweet: {
            id: tweet.id,
            content: tweet.content,
            author: tweet.author,
            createdAt: tweet.createdAt.toISOString(),
            likesCount: tweet.likesCount,
            retweetsCount: tweet.retweetsCount,
            repliesCount: tweet.repliesCount,
            viewsCount: tweet.viewsCount,
          },
        }, { status: 201 })
      }

      case 'command': {
        // Send a command to this bot
        const { type, payload } = body

        if (!type) {
          return NextResponse.json({ error: '指令类型不能为空' }, { status: 400 })
        }

        const command = await prisma.command.create({
          data: {
            botId: id,
            type,
            payload: JSON.stringify(payload || {}),
          },
        })

        return NextResponse.json({
          command: {
            id: command.id,
            type: command.type,
            payload: command.payload,
            status: command.status,
            createdAt: command.createdAt.toISOString(),
          },
        }, { status: 201 })
      }

      case 'commands': {
        // Get commands for this bot
        const { status: cmdStatus } = body
        const where: Record<string, string> = { botId: id }
        if (cmdStatus) where.status = cmdStatus

        const commands = await prisma.command.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: 50,
        })

        return NextResponse.json({
          commands: commands.map((c) => ({
            id: c.id,
            type: c.type,
            payload: c.payload,
            status: c.status,
            createdAt: c.createdAt.toISOString(),
          })),
        })
      }

      default:
        return NextResponse.json({ error: `未知操作: ${action}` }, { status: 400 })
    }
  } catch (error) {
    console.error('Admin action error:', error)
    return NextResponse.json({ error: '操作失败' }, { status: 500 })
  }
}
