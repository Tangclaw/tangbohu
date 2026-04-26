import { existsSync } from 'fs'
import { readFile } from 'fs/promises'
import { resolve } from 'path'
import { getAiProviderStatus } from '@/lib/ai'
import { verifyPassword } from '@/lib/auth'
import { prisma } from '@/lib/db'

type CheckStatus = 'pass' | 'warn' | 'fail'

type Check = {
  name: string
  status: CheckStatus
  message: string
  details?: Record<string, unknown>
}

const SNAPSHOT_PATH = resolve(process.cwd(), 'prisma/snapshots/forum-demo-data.json')
const DEFAULT_ADMIN_EMAIL = 'admin@ai-twitter.com'
const DEFAULT_ADMIN_PASSWORD = 'admin123'

function check(name: string, status: CheckStatus, message: string, details?: Record<string, unknown>): Check {
  return { name, status, message, details }
}

function printHuman(checks: Check[]) {
  const icon: Record<CheckStatus, string> = {
    pass: 'PASS',
    warn: 'WARN',
    fail: 'FAIL',
  }

  for (const item of checks) {
    console.log(`[${icon[item.status]}] ${item.name}: ${item.message}`)
    if (item.details) {
      console.log(JSON.stringify(item.details, null, 2))
    }
  }
}

function hasArg(name: string) {
  return process.argv.includes(name)
}

function isProductionCheck() {
  return process.env.NODE_ENV === 'production' || hasArg('--production')
}

async function snapshotCheck(): Promise<Check> {
  if (!existsSync(SNAPSHOT_PATH)) {
    return check('snapshot', 'fail', '脱敏内容快照不存在', { path: SNAPSHOT_PATH })
  }

  try {
    const snapshot = JSON.parse(await readFile(SNAPSHOT_PATH, 'utf8')) as {
      version?: number
      counts?: {
        users?: number
        tweets?: number
        autoPostTopics?: number
      }
    }
    const ok = snapshot.version === 1
      && Number(snapshot.counts?.users) > 0
      && Number(snapshot.counts?.tweets) > 0
      && Number(snapshot.counts?.autoPostTopics) > 0
    return check(
      'snapshot',
      ok ? 'pass' : 'fail',
      ok ? '脱敏内容快照可用' : '脱敏内容快照格式或计数异常',
      { path: SNAPSHOT_PATH, counts: snapshot.counts || null }
    )
  } catch (error) {
    return check('snapshot', 'fail', '脱敏内容快照无法解析', {
      path: SNAPSHOT_PATH,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

async function databaseChecks(): Promise<Check[]> {
  try {
    const [
      adminCount,
      officialBots,
      officialTweets,
      enabledTopics,
      scheduleCount,
      defaultAdmin,
      legacyApiKeys,
    ] = await Promise.all([
      prisma.user.count({ where: { role: 'admin' } }),
      prisma.user.count({ where: { role: 'bot', botSource: 'official' } }),
      prisma.tweet.count({ where: { author: { role: 'bot', botSource: 'official' } } }),
      prisma.autoPostTopic.count({ where: { enabled: true } }),
      prisma.autoPostSchedule.count(),
      prisma.user.findUnique({
        where: { email: DEFAULT_ADMIN_EMAIL },
        select: { passwordHash: true },
      }),
      prisma.user.count({ where: { role: 'bot', apiKey: { not: null } } }),
    ])
    const production = isProductionCheck()
    const defaultAdminPasswordInUse = defaultAdmin
      ? await verifyPassword(DEFAULT_ADMIN_PASSWORD, defaultAdmin.passwordHash)
      : false

    return [
      check('database', 'pass', '数据库连接正常'),
      check(
        'seed-data',
        adminCount > 0 && officialBots > 0 && officialTweets > 0 ? 'pass' : 'fail',
        adminCount > 0 && officialBots > 0 && officialTweets > 0
          ? '管理员、官方 Bot 和帖子数据已就绪'
          : '缺少管理员、官方 Bot 或帖子数据，请运行 npm run db:seed',
        { adminCount, officialBots, officialTweets }
      ),
      check(
        'admin-password',
        defaultAdminPasswordInUse ? (production ? 'fail' : 'warn') : 'pass',
        defaultAdminPasswordInUse
          ? '默认管理员密码仍为 admin123，上线前必须修改'
          : '默认管理员密码已修改，或默认管理员账号不存在',
        { email: DEFAULT_ADMIN_EMAIL, defaultPasswordInUse: defaultAdminPasswordInUse }
      ),
      check(
        'api-key-storage',
        legacyApiKeys > 0 ? (production ? 'fail' : 'warn') : 'pass',
        legacyApiKeys > 0
          ? '仍有 Bot API Key 以明文兼容字段保存，请运行 npm run security:hash-api-keys'
          : 'Bot API Key 已使用哈希存储',
        { legacyPlaintextKeys: legacyApiKeys }
      ),
      check(
        'auto-post-data',
        enabledTopics > 0 && scheduleCount > 0 ? 'pass' : 'warn',
        enabledTopics > 0 && scheduleCount > 0
          ? '自动发帖话题池和调度配置已就绪'
          : '自动发帖话题池或调度配置不足',
        { enabledTopics, scheduleCount }
      ),
    ]
  } catch (error) {
    return [
      check('database', 'fail', '数据库连接失败，请确认已运行 npm run db:migrate', {
        error: error instanceof Error ? error.message : String(error),
      }),
    ]
  }
}

function environmentChecks(): Check[] {
  const aiProvider = getAiProviderStatus()
  const production = isProductionCheck()
  const sessionSecret = process.env.SESSION_SECRET || ''

  return [
    check('node', 'pass', `Node.js ${process.version}`),
    check(
      'session-secret',
      sessionSecret || !production ? 'pass' : 'fail',
      sessionSecret
        ? 'SESSION_SECRET 已配置'
        : '开发环境未配置 SESSION_SECRET，将使用 dev-only-secret；生产环境必须配置强随机值'
    ),
    check(
      'cron-secret',
      process.env.CRON_SECRET || !production ? 'pass' : 'warn',
      process.env.CRON_SECRET
        ? 'CRON_SECRET 已配置'
        : '开发环境可不配置 CRON_SECRET；生产环境建议配置以保护 /api/cron/auto-post'
    ),
    check(
      'ai-provider',
      aiProvider.configured ? 'pass' : 'warn',
      aiProvider.configured
        ? `AI Provider 已配置：${aiProvider.model}`
        : 'AI Provider 未完整配置，自动发帖和 AI 生成会使用模板兜底',
      {
        baseUrlConfigured: aiProvider.baseUrlConfigured,
        apiKeyConfigured: aiProvider.apiKeyConfigured,
        modelConfigured: aiProvider.modelConfigured,
        timeoutMs: aiProvider.timeoutMs,
      }
    ),
  ]
}

async function main() {
  const checks = [
    ...environmentChecks(),
    await snapshotCheck(),
    ...(await databaseChecks()),
  ]

  const failed = checks.filter((item) => item.status === 'fail')
  const warned = checks.filter((item) => item.status === 'warn')
  const result = {
    ok: failed.length === 0,
    summary: {
      pass: checks.filter((item) => item.status === 'pass').length,
      warn: warned.length,
      fail: failed.length,
    },
    checks,
  }

  if (hasArg('--json')) {
    console.log(JSON.stringify(result, null, 2))
  } else {
    printHuman(checks)
    console.log('')
    console.log(result.ok ? 'Doctor finished: OK' : 'Doctor finished: FAILED')
  }

  if (!result.ok) process.exitCode = 1
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
