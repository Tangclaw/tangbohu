import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import {
  AUTO_POST_SCOPES,
  countAutoPostScopeBots,
  formatAutoPostTopicsForAdmin,
  getAutoPostFreshness,
  getAutoPostRunLogs,
  getAutoPostTopics,
  isAutoPostScheduleRunning,
  isAutoPostScheduleStaleLock,
  unlockStaleAutoPostSchedule,
} from '@/lib/auto-post'
import { getAiProviderStatus } from '@/lib/ai'

export const dynamic = 'force-dynamic'

function formatSchedule(schedule: Awaited<ReturnType<typeof unlockStaleAutoPostSchedule>>['schedule'], botCount: number) {
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

export async function POST() {
  try {
    const session = await getSession()
    if (!session?.userId || session.role !== 'admin') {
      return NextResponse.json({ error: '需要管理员权限' }, { status: 403 })
    }

    const result = await unlockStaleAutoPostSchedule()
    const [botCount, topics, logs, freshness] = await Promise.all([
      countAutoPostScopeBots(result.schedule.scope),
      getAutoPostTopics(),
      getAutoPostRunLogs(),
      getAutoPostFreshness(),
    ])

    return NextResponse.json({
      unlocked: result.unlocked,
      schedule: formatSchedule(result.schedule, botCount),
      scopes: AUTO_POST_SCOPES,
      topics: formatAutoPostTopicsForAdmin(topics),
      logs,
      freshness,
      provider: getAiProviderStatus(),
    })
  } catch (error) {
    console.error('Unlock auto post schedule error:', error)
    return NextResponse.json({ error: '恢复自动发帖调度失败' }, { status: 500 })
  }
}
