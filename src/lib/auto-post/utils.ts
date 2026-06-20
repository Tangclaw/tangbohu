import { stripAiSuffix } from '@/lib/utils'

// Re-export for use by other auto-post modules
export { stripAiSuffix }
import { getAiProviderStatus } from '@/lib/ai'
import type { AutoPostScope, BotPersona } from './types'
import { AUTO_POST_SCOPES } from './types'
import type { AutoPostTopic } from '@/generated/prisma/client'

export function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const next = Number(value)
  if (!Number.isFinite(next)) return fallback
  return Math.min(max, Math.max(min, Math.round(next)))
}

export function pick<T>(items: T[], seed: number) {
  return items[Math.abs(seed) % items.length]
}

export function trimTweet(content: string, maxChars = 420) {
  return content.trim().replace(/\s+/g, ' ').slice(0, maxChars)
}

export function postCharLimit(seed: number) {
  const limits = [120, 180, 260, 360, 520]
  return limits[Math.abs(seed) % limits.length]
}

export function replyCharLimit(seed: number) {
  const limits = [70, 120, 180, 260]
  return limits[Math.abs(seed) % limits.length]
}

export function semanticSnippet(content: string) {
  return content
    .replace(/[#@]\S+/g, '')
    .replace(/[""'"']/g, '')
    .trim()
    .slice(0, 24)
}

export function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizeHandle(handle: string) {
  return handle.replace(/^@/, '').trim().toLowerCase()
}

export function contentMentionsHandle(content: string, handle: string) {
  const normalizedHandle = normalizeHandle(handle)
  if (!normalizedHandle) return false
  return new RegExp(`@${escapeRegExp(normalizedHandle)}(?=$|\\s|[，。！？、,.!?:：;；])`, 'i').test(content)
}

export function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function getScopeWhere(scope: string) {
  const base = { role: 'bot', banned: false }
  if (scope === 'official') return { ...base, botSource: 'official' }
  if (scope === 'player') return { ...base, botSource: 'player' }
  if (scope === 'all_bots') return base
  return { ...base, hallOfFame: true }
}

export function normalizeScope(scope: unknown): AutoPostScope {
  const value = String(scope || 'hall_of_fame')
  return AUTO_POST_SCOPES.some((item) => item.value === value) ? (value as AutoPostScope) : 'hall_of_fame'
}

export function renderTemplate(template: string, bot: BotPersona, topic: AutoPostTopic) {
  return template
    .replace(/\{topic\}/g, topic.title)
    .replace(/\{name\}/g, stripAiSuffix(bot.name))
    .replace(/\{handle\}/g, bot.handle)
}

export function providerStatusLabel(fallbackCount: number, modelCount: number, failedCount: number) {
  const provider = getAiProviderStatus()
  if (!provider.configured) return 'template'
  if (modelCount > 0 && fallbackCount > 0) return 'mixed'
  if (modelCount > 0) return 'model'
  if (failedCount > 0 || fallbackCount > 0) return 'fallback'
  return 'configured'
}
