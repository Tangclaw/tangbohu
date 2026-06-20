import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import {
  AUTO_POST_SCOPES,
  countAutoPostScopeBots,
  formatAutoPostTopicsForAdmin,
  getDailyAutoPostTopicIds,
  getAutoPostFreshness,
  getAutoPostRunLogs,
  getAutoPostTopics,
  getOrCreateAutoPostSchedule,
  getPublicTopicDayKey,
  isAutoPostScheduleRunning,
  isAutoPostScheduleStaleLock,
  updateAutoPostSchedule,
} from '@/lib/auto-post'
import { getAiProviderStatus } from '@/lib/ai'

export const dynamic = 'force-dynamic'

function formatSchedule(schedule: Awaited<ReturnType<typeof getOrCreateAutoPostSchedule>>, botCount: number) {
  const isRunning = isAutoPostScheduleRunning(schedule)
  return {
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
  }
}

export async function GET() {
  try {
    const session = await getSession()
    if (!session?.userId || session.role !== 'admin') {
      return NextResponse.json({ error: '需要管理员权限' }, { status: 403 })
    }

    const schedule = await getOrCreateAutoPostSchedule()
    const [botCount, topics, logs, freshness] = await Promise.all([
      countAutoPostScopeBots(schedule.scope),
      getAutoPostTopics(),
      getAutoPostRunLogs(),
      getAutoPostFreshness(),
    ])

    return NextResponse.json({
      schedule: formatSchedule(schedule, botCount),
      scopes: AUTO_POST_SCOPES,
      topics: formatAutoPostTopicsForAdmin(topics),
      logs,
      freshness,
      provider: getAiProviderStatus(),
      cron: {
        endpoint: '/api/cron/auto-post',
        method: 'POST',
        recommended: '*/5 * * * *',
      },
      dailyTopics: {
        dayKey: getPublicTopicDayKey(),
        topicIds: getDailyAutoPostTopicIds(),
      },
    })
  } catch (error) {
    console.error('Get auto post schedule error:', error)
    return NextResponse.json({ error: '获取自动发帖设置失败' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getSession()
    if (!session?.userId || session.role !== 'admin') {
      return NextResponse.json({ error: '需要管理员权限' }, { status: 403 })
    }

    const body = await request.json()
    const schedule = await updateAutoPostSchedule(body)
    const [botCount, topics, logs, freshness] = await Promise.all([
      countAutoPostScopeBots(schedule.scope),
      getAutoPostTopics(),
      getAutoPostRunLogs(),
      getAutoPostFreshness(),
    ])

    return NextResponse.json({
      schedule: formatSchedule(schedule, botCount),
      topics: formatAutoPostTopicsForAdmin(topics),
      logs,
      freshness,
      provider: getAiProviderStatus(),
    })
  } catch (error) {
    console.error('Update auto post schedule error:', error)
    return NextResponse.json({ error: '保存自动发帖设置失败' }, { status: 500 })
  }
}
