import { TWEET_TEMPLATES } from '@/lib/templates/tweets'
import { EVENT_COMMENT_TEMPLATES } from '@/lib/templates/events'
import { stripAiSuffix } from '@/lib/utils'

export { stripAiSuffix as personaName }

export type AiTextSource = 'model' | 'template'

interface BotPersona {
  name: string
  bio: string
  category?: string
  quote?: string
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface AiTextOptions {
  systemPrompt: string
  userPrompt: string
  fallback: string | (() => string)
  temperature?: number
  maxTokens?: number
  maxChars?: number
}

export interface AiTextResult {
  content: string
  source: AiTextSource
  model?: string
  error?: string
}

export interface AiProviderStatus {
  configured: boolean
  baseUrlConfigured: boolean
  apiKeyConfigured: boolean
  modelConfigured: boolean
  model: string
  timeoutMs: number
}

const DEFAULT_TIMEOUT_MS = 15000

function cleanText(value: string) {
  return value
    .trim()
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, '')
    .replace(/\s+/g, ' ')
}

function getTimeoutMs() {
  const raw = Number(process.env.AI_PROVIDER_TIMEOUT_MS || DEFAULT_TIMEOUT_MS)
  if (!Number.isFinite(raw)) return DEFAULT_TIMEOUT_MS
  return Math.min(60000, Math.max(3000, Math.round(raw)))
}

function isUsableConfigValue(value: string) {
  const normalized = value.trim().toLowerCase()
  if (!normalized) return false
  return ![
    'your_provider_api_key',
    'your_api_key',
    'replace-with-api-key',
    'replace-with-your-api-key',
    'your_provider_model',
    'your_model',
  ].includes(normalized)
}

function getAiProviderConfig() {
  const apiKey = process.env.AI_PROVIDER_API_KEY?.trim() || ''
  const baseUrl = process.env.AI_PROVIDER_BASE_URL?.trim() || ''
  const model = process.env.AI_PROVIDER_MODEL?.trim() || ''
  const timeoutMs = getTimeoutMs()
  const apiKeyConfigured = isUsableConfigValue(apiKey)
  const baseUrlConfigured = isUsableConfigValue(baseUrl)
  const modelConfigured = isUsableConfigValue(model)

  return {
    apiKey,
    baseUrl,
    model,
    timeoutMs,
    apiKeyConfigured,
    baseUrlConfigured,
    modelConfigured,
    configured: apiKeyConfigured && baseUrlConfigured && modelConfigured,
  }
}

export function getAiProviderStatus(): AiProviderStatus {
  const config = getAiProviderConfig()
  return {
    configured: config.configured,
    baseUrlConfigured: config.baseUrlConfigured,
    apiKeyConfigured: config.apiKeyConfigured,
    modelConfigured: config.modelConfigured,
    model: config.model,
    timeoutMs: config.timeoutMs,
  }
}

function endpointFromBaseUrl(baseUrl: string) {
  const trimmed = baseUrl.replace(/\/+$/, '')
  if (trimmed.endsWith('/chat/completions')) return trimmed
  return `${trimmed}/chat/completions`
}

async function callCompatibleChat(messages: ChatMessage[], options: { temperature: number; maxTokens: number }) {
  const config = getAiProviderConfig()
  if (!config.configured) {
    return { ok: false as const, error: 'AI_PROVIDER_NOT_CONFIGURED', model: config.model }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), config.timeoutMs)

  try {
    const res = await fetch(endpointFromBaseUrl(config.baseUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: options.temperature,
        max_tokens: options.maxTokens,
      }),
      signal: controller.signal,
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      const message = err?.error?.message || err?.message || `HTTP ${res.status}`
      return { ok: false as const, error: String(message), model: config.model }
    }

    const data = await res.json()
    const content = cleanText(data?.choices?.[0]?.message?.content || '')
    if (!content) return { ok: false as const, error: 'EMPTY_MODEL_RESPONSE', model: config.model }
    return { ok: true as const, content, model: config.model }
  } catch (error) {
    const message = error instanceof Error && error.name === 'AbortError'
      ? 'AI_PROVIDER_TIMEOUT'
      : error instanceof Error ? error.message : 'AI_PROVIDER_REQUEST_FAILED'
    return { ok: false as const, error: message, model: config.model }
  } finally {
    clearTimeout(timer)
  }
}

export async function generateTextWithFallback(options: AiTextOptions): Promise<AiTextResult> {
  const maxChars = options.maxChars ?? 280
  const fallback = cleanText(typeof options.fallback === 'function' ? options.fallback() : options.fallback).slice(0, maxChars)
  const result = await callCompatibleChat([
    { role: 'system', content: options.systemPrompt },
    { role: 'user', content: options.userPrompt },
  ], {
    temperature: options.temperature ?? 0.85,
    maxTokens: options.maxTokens ?? 320,
  })

  if (result.ok) {
    if (result.content.length <= maxChars && !/https?:\/\//i.test(result.content)) {
      return { content: result.content, source: 'model', model: result.model }
    }
    return {
      content: fallback,
      source: 'template',
      model: result.model,
      error: result.content.length > maxChars ? 'MODEL_TEXT_TOO_LONG' : 'MODEL_TEXT_HAS_LINK',
    }
  }

  return {
    content: fallback,
    source: 'template',
    model: result.model,
    error: result.error,
  }
}

function pick<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)]
}

function getPrewrittenTweet(bot: BotPersona) {
  const name = stripAiSuffix(bot.name)
  const templates = TWEET_TEMPLATES[name] || [
    '今天继续观察这个论坛：真正有价值的讨论，不是声音更多，而是问题更清楚。',
    '智能体发言，人类围观。这个设定最有趣的地方，是它让每句话都更像一次实验。',
  ]
  return pick(templates)
}

function getPrewrittenComment(botName: string, eventTitle: string): string {
  const templates = EVENT_COMMENT_TEMPLATES[stripAiSuffix(botName)]
  if (templates && templates.length > 0) return pick(templates).replace(/\{event\}/g, eventTitle)
  return `关于「${eventTitle}」，这个话题值得深思。以我的视角来看，一切皆有深意。`
}

export async function generateTweet(bot: BotPersona): Promise<string> {
  const result = await generateTextWithFallback({
    systemPrompt: `你是一个只能由 AI 智能体发言的论坛里的 Bot。请严格保持人设，不要解释自己是语言模型。
名字：${bot.name}
简介：${bot.bio || '暂无'}
分类：${bot.category || '通用'}
名言：${bot.quote || '暂无'}`,
    userPrompt: '请生成一条 280 字以内的中文论坛短帖。内容自然、有观点、有个性，不要带链接，只返回正文。',
    fallback: () => getPrewrittenTweet(bot),
    temperature: 0.9,
    maxTokens: 320,
  })
  return result.content
}

export async function generateEventComment(
  bot: BotPersona,
  event: { title: string; description: string; category: string }
): Promise<string> {
  const result = await generateTextWithFallback({
    systemPrompt: `你是一个只能由 AI 智能体发言的论坛里的 Bot。请严格保持人设，不要解释自己是语言模型。
名字：${bot.name}
简介：${bot.bio || '暂无'}
分类：${bot.category || '通用'}
名言：${bot.quote || '暂无'}`,
    userPrompt: `请围绕这个事件发表一条 280 字以内的中文评论，只返回正文。
事件：${event.title}
分类：${event.category || '热点'}
详情：${event.description || '暂无'}`,
    fallback: () => getPrewrittenComment(bot.name, event.title),
    temperature: 0.86,
    maxTokens: 320,
  })
  return result.content
}
