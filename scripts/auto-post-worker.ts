import 'dotenv/config'
import { prisma } from '@/lib/db'
import { runDueAutoPostSchedules } from '@/lib/auto-post'

type WorkerOptions = {
  once: boolean
  forceFirstRun: boolean
  topicId: string | null
  intervalMs: number
}

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000

function readArg(name: string) {
  const prefix = `${name}=`
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length)
}

function clampInterval(value: string | undefined) {
  const parsed = Number(value || process.env.AUTO_POST_WORKER_INTERVAL_MS || DEFAULT_INTERVAL_MS)
  if (!Number.isFinite(parsed)) return DEFAULT_INTERVAL_MS
  return Math.min(60 * 60 * 1000, Math.max(10 * 1000, Math.round(parsed)))
}

function parseOptions(): WorkerOptions {
  const args = new Set(process.argv.slice(2))
  return {
    once: args.has('--once'),
    forceFirstRun: args.has('--force'),
    topicId: readArg('--topic') || null,
    intervalMs: clampInterval(readArg('--interval-ms')),
  }
}

function formatResult(result: Awaited<ReturnType<typeof runDueAutoPostSchedules>>) {
  return [
    `ran=${result.ran}`,
    `roots=${result.createdRoots}`,
    `replies=${result.createdReplies}`,
    `blocked=${result.blockedCount}`,
    `fallback=${result.fallbackCount}`,
    `failed=${result.failedCount}`,
  ].join(' ')
}

async function main() {
  const options = parseOptions()
  let running = false
  let forceNextRun = options.forceFirstRun

  const tick = async () => {
    if (running) {
      console.log(`[auto-post-worker] ${new Date().toISOString()} previous tick still running, skipped`)
      return
    }

    running = true
    try {
      const result = await runDueAutoPostSchedules({
        force: forceNextRun,
        topicId: forceNextRun ? options.topicId : null,
        trigger: forceNextRun ? 'worker-force' : 'worker',
      })
      forceNextRun = false
      console.log(`[auto-post-worker] ${new Date().toISOString()} ${formatResult(result)}`)
      for (const item of result.results) {
        console.log(`[auto-post-worker] ${item.providerStatus} ${item.message}`)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`[auto-post-worker] ${new Date().toISOString()} failed: ${message}`)
    } finally {
      running = false
    }
  }

  const shutdown = async () => {
    console.log('[auto-post-worker] shutting down')
    await prisma.$disconnect()
    process.exit(0)
  }

  process.once('SIGINT', shutdown)
  process.once('SIGTERM', shutdown)

  console.log(
    `[auto-post-worker] started intervalMs=${options.intervalMs} once=${options.once} force=${options.forceFirstRun} topic=${options.topicId || 'auto'}`
  )
  await tick()

  if (options.once) {
    await shutdown()
    return
  }

  setInterval(tick, options.intervalMs)
}

main().catch(async (error) => {
  console.error(error)
  await prisma.$disconnect()
  process.exit(1)
})
