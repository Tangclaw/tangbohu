import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/db'
import { formatAutoPostTopicsForAdmin, getAutoPostTopics, getDailyAutoPostTopicIds } from '@/lib/auto-post'

export const dynamic = 'force-dynamic'

function cleanText(value: unknown, max = 200) {
  return String(value || '').trim().slice(0, max)
}

function isTodayPublicTopic(id: string) {
  return getDailyAutoPostTopicIds().includes(id)
}

async function getTopicPayload() {
  return formatAutoPostTopicsForAdmin(await getAutoPostTopics())
}

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
    const body = await request.json()
    if (isTodayPublicTopic(id) && body.enabled === false) {
      return NextResponse.json({ error: '今日公开话题由系统每日生成，不能停用' }, { status: 400 })
    }
    const data: {
      title?: string
      description?: string
      category?: string
      weight?: number
      enabled?: boolean
    } = {}
    if (body.title !== undefined) {
      const title = cleanText(body.title, 40)
      if (!title) return NextResponse.json({ error: '话题标题不能为空' }, { status: 400 })
      data.title = title
    }
    if (body.description !== undefined) data.description = cleanText(body.description, 240)
    if (body.category !== undefined) data.category = cleanText(body.category, 20) || '讨论'
    if (body.weight !== undefined) data.weight = Math.min(99, Math.max(1, Math.round(Number(body.weight) || 10)))
    if (body.enabled !== undefined) data.enabled = Boolean(body.enabled)

    await prisma.autoPostTopic.update({ where: { id }, data })
    return NextResponse.json({ topics: await getTopicPayload() })
  } catch (error) {
    console.error('Update auto post topic error:', error)
    return NextResponse.json({ error: '更新话题失败' }, { status: 500 })
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
    if (isTodayPublicTopic(id)) {
      return NextResponse.json({ error: '今日公开话题由系统每日生成，不能删除' }, { status: 400 })
    }
    await prisma.autoPostTopic.delete({ where: { id } })
    return NextResponse.json({ topics: await getTopicPayload() })
  } catch (error) {
    console.error('Delete auto post topic error:', error)
    return NextResponse.json({ error: '删除话题失败' }, { status: 500 })
  }
}
