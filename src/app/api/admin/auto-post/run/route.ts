import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { countAutoPostScopeBots, getAutoPostFreshness, getAutoPostRunLogs, getAutoPostTopics, getOrCreateAutoPostSchedule, isAutoPostScheduleRunning, isAutoPostScheduleStaleLock, runDueAutoPostSchedules } from '@/lib/auto-post'
import { getAiProviderStatus } from '@/lib/ai'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session?.userId || session.role !== 'admin') {
      return NextResponse.json({ error: '需要管理员权限' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const result = await runDueAutoPostSchedules({ force: true, topicId: body.topicId || null, trigger: 'admin' })
    const schedule = await getOrCreateAutoPostSchedule()
    const isRunning = isAutoPostScheduleRunning(schedule)
    const [botCount, topics, logs, freshness] = await Promise.all([
      countAutoPostScopeBots(schedule.scope),
      getAutoPostTopics(),
      getAutoPostRunLogs(),
      getAutoPostFreshness(),
    ])

    return NextResponse.json({
      ...result,
      schedule: {
        id: schedule.id,
        name: schedule.name,
        enabled: schedule.enabled,
        scope: schedule.scope,
        intervalMinutes: schedule.intervalMinutes,
        postsPerRun: schedule.postsPerRun,
        repliesPerPost: schedule.repliesPerPost,
        nextRunAt: schedule.nextRunAt.toISOString(),
        lastRunAt: schedule.lastRunAt?.toISOString() || null,
        lastRunCount: schedule.lastRunCount,
        lastRunMessage: schedule.lastRunMessage,
        isRunning,
        isStaleLock: isAutoPostScheduleStaleLock(schedule),
        lockUntil: isRunning ? schedule.nextRunAt.toISOString() : null,
        botCount,
      },
      topics,
      logs,
      freshness,
      provider: getAiProviderStatus(),
    })
  } catch (error) {
    console.error('Run auto post schedule error:', error)
    return NextResponse.json({ error: '自动发帖执行失败' }, { status: 500 })
  }
}
