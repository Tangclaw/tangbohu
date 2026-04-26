import { NextResponse } from 'next/server'
import { getAiProviderStatus } from '@/lib/ai'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

function buildStatus(ok: boolean) {
  return ok ? 200 : 503
}

export async function GET() {
  const startedAt = Date.now()

  try {
    const [
      adminCount,
      officialBots,
      officialTweets,
      totalUsers,
      totalTweets,
      topics,
      schedule,
    ] = await Promise.all([
      prisma.user.count({ where: { role: 'admin' } }),
      prisma.user.count({ where: { role: 'bot', botSource: 'official' } }),
      prisma.tweet.count({ where: { author: { role: 'bot', botSource: 'official' } } }),
      prisma.user.count(),
      prisma.tweet.count(),
      prisma.autoPostTopic.count({ where: { enabled: true } }),
      prisma.autoPostSchedule.findFirst({
        orderBy: { createdAt: 'asc' },
        select: {
          enabled: true,
          scope: true,
          intervalMinutes: true,
          postsPerRun: true,
          repliesPerPost: true,
          nextRunAt: true,
          lastRunAt: true,
          lastRunMessage: true,
        },
      }),
    ])

    const contentOk = adminCount > 0 && officialBots > 0 && officialTweets > 0
    const aiProvider = getAiProviderStatus()
    const ok = contentOk

    return NextResponse.json({
      ok,
      service: 'ai-forum',
      timestamp: new Date().toISOString(),
      uptimeSec: Math.round(process.uptime()),
      latencyMs: Date.now() - startedAt,
      checks: {
        database: {
          ok: true,
        },
        content: {
          ok: contentOk,
          admins: adminCount,
          officialBots,
          officialTweets,
          totalUsers,
          totalTweets,
          enabledAutoPostTopics: topics,
        },
        aiProvider: {
          configured: aiProvider.configured,
          baseUrlConfigured: aiProvider.baseUrlConfigured,
          apiKeyConfigured: aiProvider.apiKeyConfigured,
          modelConfigured: aiProvider.modelConfigured,
          model: aiProvider.model,
          timeoutMs: aiProvider.timeoutMs,
        },
        autoPost: {
          configured: Boolean(schedule),
          enabled: schedule?.enabled ?? false,
          scope: schedule?.scope ?? '',
          intervalMinutes: schedule?.intervalMinutes ?? 0,
          postsPerRun: schedule?.postsPerRun ?? 0,
          repliesPerPost: schedule?.repliesPerPost ?? 0,
          nextRunAt: schedule?.nextRunAt?.toISOString() ?? null,
          lastRunAt: schedule?.lastRunAt?.toISOString() ?? null,
          lastRunMessage: schedule?.lastRunMessage ?? '',
        },
      },
    }, {
      status: buildStatus(ok),
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN_HEALTH_ERROR'
    return NextResponse.json({
      ok: false,
      service: 'ai-forum',
      timestamp: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
      checks: {
        database: {
          ok: false,
          error: message,
        },
      },
    }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    })
  }
}
