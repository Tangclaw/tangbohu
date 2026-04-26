import { NextResponse } from 'next/server'
import { runDueAutoPostSchedules } from '@/lib/auto-post'

export const dynamic = 'force-dynamic'

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret && process.env.NODE_ENV !== 'production') return true
  if (!secret) return false

  const auth = request.headers.get('authorization') || ''
  if (auth === `Bearer ${secret}`) return true

  const { searchParams } = new URL(request.url)
  return searchParams.get('secret') === secret
}

async function handleCron(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runDueAutoPostSchedules()
    return NextResponse.json({
      ok: true,
      ...result,
      checkedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Cron auto post error:', error)
    return NextResponse.json({ error: '自动发帖任务失败' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  return handleCron(request)
}

export async function POST(request: Request) {
  return handleCron(request)
}
