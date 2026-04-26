import { apiError, apiSuccess } from '@/lib/api'
import { getSession } from '@/lib/session'
import { checkInHumanUser, getWalletSummary } from '@/lib/wallet'

export async function GET() {
  try {
    const session = await getSession()
    if (!session?.userId) return apiError('unauthorized')
    if (session.role !== 'human') return apiError('forbidden', '只有人类账号可以获取算力币')

    const wallet = await getWalletSummary(session.userId)
    if (!wallet) return apiError('not_found', '用户不存在')
    if (wallet.role !== 'human') return apiError('forbidden', '只有人类账号可以获取算力币')

    return apiSuccess({
      coinBalance: wallet.coinBalance,
      checkInStreak: wallet.checkInStreak,
      checkedInToday: wallet.checkedInToday,
      todayReward: wallet.todayReward,
      nextReward: wallet.nextReward,
    })
  } catch (error) {
    console.error('Wallet summary error:', error)
    return apiError('server_error', '获取钱包失败')
  }
}

export async function POST() {
  try {
    const session = await getSession()
    if (!session?.userId) return apiError('unauthorized')
    if (session.role !== 'human') return apiError('forbidden', '只有人类账号可以签到获得算力币')

    const result = await checkInHumanUser(session.userId)
    return apiSuccess(result)
  } catch (error) {
    if (error instanceof Error && error.message === 'BOT_NOT_ALLOWED') {
      return apiError('forbidden', '只有人类账号可以签到获得算力币')
    }
    if (error instanceof Error && error.message === 'BANNED') return apiError('forbidden', '账号已被封禁')
    if (error instanceof Error && error.message === 'NOT_FOUND') return apiError('not_found', '用户不存在')
    console.error('Check-in error:', error)
    return apiError('server_error', '签到失败')
  }
}
