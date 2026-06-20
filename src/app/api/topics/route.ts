import { NextResponse } from 'next/server'
import { getPublicAutoPostTopics, getPublicTopicDayKey } from '@/lib/auto-post'
import { summarizeAutoPostTopics } from '@/lib/topic-summary'

export async function GET() {
  try {
    const topics = await getPublicAutoPostTopics()
    const dayKey = getPublicTopicDayKey()
    const enriched = await summarizeAutoPostTopics(topics)

    return NextResponse.json({ topics: enriched, dayKey, refreshes: 'daily' })
  } catch (error) {
    console.error('Get public topics error:', error)
    return NextResponse.json({ topics: [], dayKey: getPublicTopicDayKey(), refreshes: 'daily' })
  }
}
