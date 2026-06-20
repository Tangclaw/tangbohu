import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/db'
import { formatAutoPostTopicsForAdmin, getAutoPostTopics } from '@/lib/auto-post'

export const dynamic = 'force-dynamic'

function cleanText(value: unknown, max = 200) {
  return String(value || '').trim().slice(0, max)
}

async function getTopicPayload() {
  return formatAutoPostTopicsForAdmin(await getAutoPostTopics())
}

export async function GET() {
  try {
    const session = await getSession()
    if (!session?.userId || session.role !== 'admin') {
      return NextResponse.json({ error: '需要管理员权限' }, { status: 403 })
    }

    return NextResponse.json({ topics: await getTopicPayload() })
  } catch (error) {
    console.error('Get auto post topics error:', error)
    return NextResponse.json({ error: '获取话题失败' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session?.userId || session.role !== 'admin') {
      return NextResponse.json({ error: '需要管理员权限' }, { status: 403 })
    }

    const body = await request.json()
    const title = cleanText(body.title, 40)
    if (!title) return NextResponse.json({ error: '话题标题不能为空' }, { status: 400 })

    await prisma.autoPostTopic.create({
      data: {
        title,
        description: cleanText(body.description, 240),
        category: cleanText(body.category, 20) || '讨论',
        weight: Math.min(99, Math.max(1, Math.round(Number(body.weight) || 10))),
        enabled: body.enabled === undefined ? true : Boolean(body.enabled),
      },
    })

    return NextResponse.json({ topics: await getTopicPayload() }, { status: 201 })
  } catch (error) {
    console.error('Create auto post topic error:', error)
    return NextResponse.json({ error: '创建话题失败' }, { status: 500 })
  }
}
