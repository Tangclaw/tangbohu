import type { AutoPostSchedule } from '@/generated/prisma/client'

export const AUTO_POST_SCOPES = [
  { value: 'hall_of_fame', label: '名人堂 AI' },
  { value: 'official', label: '平台水军 Bot' },
  { value: 'player', label: '玩家接入 Bot' },
  { value: 'all_bots', label: '全部 Bot' },
] as const

export type AutoPostScope = (typeof AUTO_POST_SCOPES)[number]['value']

export type BotPersona = {
  id: string
  name: string
  handle: string
  bio: string
  category: string
  quote: string
}

export type ReplyTarget = {
  id: string
  content: string
  author: BotPersona
}

export type ReplyCreationStats = {
  createdReplies: number
  blockedCount: number
  failedCount: number
  fallbackCount: number
  modelCount: number
  lastError: string
  tweetId?: string
  content?: string
  author?: BotPersona
}

export type DebateTurn = {
  id: string
  author: BotPersona
  content: string
}

export interface AutoPostRunResult {
  scheduleId: string
  scheduleName: string
  scope: string
  topicId: string | null
  topicTitle: string
  createdRoots: number
  createdReplies: number
  blockedCount: number
  skippedCount: number
  failedCount: number
  fallbackCount: number
  providerStatus: string
  message: string
  nextRunAt: Date
}

export const DEFAULT_AUTO_POST_SCHEDULE_ID = 'default-auto-post'
export const DEFAULT_AUTO_POST_INTERVAL_MINUTES = 60
export const DEFAULT_AUTO_POST_POSTS_PER_RUN = 1
export const DEFAULT_AUTO_POST_REPLIES_PER_POST = 3
export const AUTO_POST_RECENT_ROOT_HOURS = 72
export const AUTO_POST_RECENT_ROOT_LIMIT = 20
export const AUTO_POST_CATCH_UP_REPLY_LIMIT = 30
export const AUTO_POST_TOPICS_PER_RUN = 2
export const AUTO_POST_CLAIM_LOCK_MS = 5 * 60 * 1000
export const AUTO_POST_RUNNING_MESSAGE = '自动发帖执行中...'

export function isAutoPostScheduleRunning(schedule: Pick<AutoPostSchedule, 'lastRunMessage' | 'nextRunAt'>, now = new Date()) {
  return schedule.lastRunMessage === AUTO_POST_RUNNING_MESSAGE && schedule.nextRunAt > now
}

export function isAutoPostScheduleStaleLock(schedule: Pick<AutoPostSchedule, 'lastRunMessage' | 'nextRunAt'>, now = new Date()) {
  return schedule.lastRunMessage === AUTO_POST_RUNNING_MESSAGE && schedule.nextRunAt <= now
}
