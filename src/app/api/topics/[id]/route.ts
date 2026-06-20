import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { ensureDailyAutoPostTopics } from '@/lib/auto-post'
import { summarizeAutoPostTopics } from '@/lib/topic-summary'

export const dynamic = 'force-dynamic'

async function enrichTopic(topicId: string) {
  const topic = await prisma.autoPostTopic.findUnique({ where: { id: topicId } })
  if (!topic) return null

  const [summary] = await summarizeAutoPostTopics([topic])
  return summary
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDailyAutoPostTopics()
    const { id } = await params
    const topic = await enrichTopic(id)
    if (!topic) return NextResponse.json({ error: '话题不存在' }, { status: 404 })
    return NextResponse.json({ topic })
  } catch (error) {
    console.error('Get topic detail error:', error)
    return NextResponse.json({ error: '获取话题失败' }, { status: 500 })
  }
}
