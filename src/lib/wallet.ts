import { prisma } from '@/lib/db'

export const CHECK_IN_BASE_REWARD = 1
export const CHECK_IN_WEEKLY_BONUS = 1

export function shanghaiDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function addDays(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + days))
  return date.toISOString().slice(0, 10)
}

export function checkInRewardForStreak(streak: number) {
  return CHECK_IN_BASE_REWARD + (streak > 0 && streak % 7 === 0 ? CHECK_IN_WEEKLY_BONUS : 0)
}

export async function getWalletSummary(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      coinBalance: true,
      checkInStreak: true,
      lastCheckInAt: true,
    },
  })
  if (!user) return null

  const todayKey = shanghaiDateKey()
  const todayCheckIn = await prisma.dailyCheckIn.findUnique({
    where: { userId_checkDate: { userId, checkDate: todayKey } },
    select: { reward: true, streak: true, createdAt: true },
  })

  return {
    role: user.role,
    coinBalance: user.coinBalance,
    checkInStreak: user.checkInStreak,
    lastCheckInAt: user.lastCheckInAt,
    checkedInToday: Boolean(todayCheckIn),
    todayReward: todayCheckIn?.reward ?? 0,
    nextReward: checkInRewardForStreak(user.checkInStreak + 1),
  }
}

export async function checkInHumanUser(userId: string) {
  const todayKey = shanghaiDateKey()
  const yesterdayKey = addDays(todayKey, -1)

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        banned: true,
        coinBalance: true,
        checkInStreak: true,
        lastCheckInAt: true,
      },
    })
    if (!user) throw new Error('NOT_FOUND')
    if (user.banned) throw new Error('BANNED')
    if (user.role !== 'human') throw new Error('BOT_NOT_ALLOWED')

    const existing = await tx.dailyCheckIn.findUnique({
      where: { userId_checkDate: { userId, checkDate: todayKey } },
    })
    if (existing) {
      return {
        alreadyCheckedIn: true,
        reward: 0,
        coinBalance: user.coinBalance,
        streak: user.checkInStreak,
        checkedInToday: true,
        nextReward: checkInRewardForStreak(user.checkInStreak + 1),
      }
    }

    const lastKey = user.lastCheckInAt ? shanghaiDateKey(user.lastCheckInAt) : ''
    const streak = lastKey === yesterdayKey ? user.checkInStreak + 1 : 1
    const reward = checkInRewardForStreak(streak)

    const updated = await tx.user.update({
      where: { id: userId },
      data: {
        coinBalance: { increment: reward },
        checkInStreak: streak,
        lastCheckInAt: new Date(),
      },
      select: { coinBalance: true, checkInStreak: true },
    })

    await tx.dailyCheckIn.create({
      data: {
        userId,
        checkDate: todayKey,
        reward,
        streak,
      },
    })

    return {
      alreadyCheckedIn: false,
      reward,
      coinBalance: updated.coinBalance,
      streak: updated.checkInStreak,
      checkedInToday: true,
      nextReward: checkInRewardForStreak(updated.checkInStreak + 1),
    }
  })
}
