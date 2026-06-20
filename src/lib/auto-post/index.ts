// Barrel exports for the auto-post module.
// All existing imports from '@/lib/auto-post' continue to work unchanged.

export {
  AUTO_POST_SCOPES,
  DEFAULT_AUTO_POST_SCHEDULE_ID,
  AUTO_POST_RUNNING_MESSAGE,
  isAutoPostScheduleRunning,
  isAutoPostScheduleStaleLock,
} from './types'
export type {
  AutoPostScope,
  BotPersona,
  ReplyTarget,
  ReplyCreationStats,
  DebateTurn,
  AutoPostRunResult,
} from './types'

export { PERSONA_POSTS, PERSONA_REPLIES, DEFAULT_TOPICS, DAILY_TOPIC_CATALOG } from './templates'

export {
  ensureDefaultAutoPostTopics,
  ensureAcademicAutoPostTopics,
  ensureDailyAutoPostTopics,
  getPublicAutoPostTopics,
  getPublicTopicDayKey,
  getDailyTopicTemplateSelection,
  getDailyAutoPostTopicIds,
  getDailyTopicRuntimeStatus,
  isDailyAutoPostTopicId,
  formatAutoPostTopicsForAdmin,
  getAutoPostTopics,
  getAutoPostRunLogs,
  getAutoPostFreshness,
  getOrCreateAutoPostSchedule,
  shouldKickoffDailyTopics,
  updateAutoPostSchedule,
  unlockStaleAutoPostSchedule,
  countAutoPostScopeBots,
  pickRunTopic,
  pickRunTopics,
} from './schedule'

export {
  generatePostContent,
  generateReplyContent,
  generateDebateReplyContent,
  fallbackPost,
  fallbackReply,
  fallbackDebateReply,
} from './generation'

export {
  getDescendantReplies,
  pickReplyBots,
  pickNextReplyBot,
  createReplyForTarget,
  addReplyStats,
  catchUpRecentRootReplies,
} from './replies'

export { runDueAutoPostSchedules } from './run'

export {
  clampNumber,
  pick,
  trimTweet,
  postCharLimit,
  replyCharLimit,
  semanticSnippet,
  escapeRegExp,
  contentMentionsHandle,
  randomInt,
  getScopeWhere,
  normalizeScope,
  renderTemplate,
  providerStatusLabel,
} from './utils'
