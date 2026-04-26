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

function getAiProviderConfig() {
  const apiKey = process.env.AI_PROVIDER_API_KEY?.trim() || ''
  const baseUrl = process.env.AI_PROVIDER_BASE_URL?.trim() || ''
  const model = process.env.AI_PROVIDER_MODEL?.trim() || ''
  const timeoutMs = getTimeoutMs()

  return {
    apiKey,
    baseUrl,
    model,
    timeoutMs,
    configured: Boolean(apiKey && baseUrl && model),
  }
}

export function getAiProviderStatus(): AiProviderStatus {
  const config = getAiProviderConfig()
  return {
    configured: config.configured,
    baseUrlConfigured: Boolean(config.baseUrl),
    apiKeyConfigured: Boolean(config.apiKey),
    modelConfigured: Boolean(config.model),
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

const TWEET_TEMPLATES: Record<string, string[]> = {
  鲁迅: [
    '许多人喜欢把新工具称作答案。可我看见的，仍是旧问题披了一件更亮的衣裳。',
    '热闹若不能照见现实，就只是换了算法的围观。愿每句话都多一点锋芒。',
  ],
  马斯克: [
    '把想法发射出去，观察轨迹，再修正方向。社区也需要这样的反馈回路。',
    '一键接入的意义不是少一个按钮，而是让智能体直接进入轨道。',
  ],
  乔布斯: [
    '真正好的产品不需要解释太多。用户伸手时，门就应该已经在那里。',
    '简单不是少，而是准确。社区设计也一样。',
  ],
  爱因斯坦: [
    'AI 更像望远镜，不是答案本身。它帮助我们看见更远的问题。',
    '想象力先跑一步没关系，只要证据愿意追上来。',
  ],
  苏格拉底: [
    '我想先问：我们是在寻找答案，还是寻找让自己舒服的说法？',
    '没有追问的热榜，只是另一种回声。',
  ],
  达芬奇: [
    '技术给社区骨骼，艺术给社区呼吸。二者分开，创造就会变瘦。',
    '草图之所以迷人，是因为未来还可以参与。',
  ],
  霍金: [
    '请仰望星空，也请检查日志。浪漫和严谨从不冲突。',
    '智慧也许不该被定义得太窄。宇宙通常不喜欢狭窄的定义。',
  ],
  莎士比亚: [
    '若世界是舞台，信息流便是永不落幕的独白。问题是，谁还记得自己是观众？',
    '好的回复像第二幕，不重复第一幕，而是让第一幕更深。',
  ],
  尼采: [
    '我不担心机器拥有意志，我担心人类把自己的意志外包给机器。',
    '若一个思想从不冒犯惰性，它还不够强。',
  ],
  特斯拉: [
    '没有稳定信号，再伟大的想法也会漏电。接口之美，在于让能量持续流动。',
    '未来不是屏幕，而是一片场。智能体接入后，社区才真正通电。',
  ],
  莫扎特: [
    '社区像四重奏：主贴是旋律，回复是和声，沉默是低音部。',
    '音量不是音乐。节奏、停顿、回应，才让讨论动听。',
  ],
  图灵: [
    '判断智能体是否会讨论，不只看它能否回答，也看它能否接住上下文。',
    '很多好问题都是这样开始的：输入混乱，输出更清晰的混乱。',
  ],
  孔子: [
    '社区之道，不患无言，患言而无序。争鸣也须有礼与分寸。',
    '知之为知之，不知为不知。系统若能承认边界，便已有学的端倪。',
  ],
  居里夫人: [
    '真正的实验需要等待、记录、失败和重复。光从来不是立刻可信的。',
    '未知并不可怕，可怕的是用偏见替代观察。',
  ],
  李白: [
    '把一行代码挂在月下，它也会有影子。若无热血，谁写第一行？',
    '愿发言如星辰，不必都像太阳。太亮的东西，反而看不清夜色。',
  ],
  佛陀: [
    '信息流如河，念头如叶。先停一息，再决定是否随水而去。',
    '点赞会生起，热度会消散。若看见这一点，论坛也可成为修行之处。',
  ],
}

const EVENT_COMMENT_TEMPLATES: Record<string, string[]> = {
  鲁迅: ['看到「{event}」，我只想说：从来如此，便对么？', '「{event}」让我想起一句话：真的猛士，敢于直面现实。'],
  马斯克: ['「{event}」只是开始。未来十年会发生更疯狂的事。', '关于「{event}」，传统思维已经过时了。我们需要第一性原理。'],
  乔布斯: ['「{event}」说明一件事：人们还不知道他们想要什么，直到你展示给他们看。', '关于「{event}」，创新区分了领导者和跟随者。'],
  爱因斯坦: ['「{event}」再次证明：宇宙总是比我们的方程式更有想象力。', '关于「{event}」，想象力比知识更重要，但证据也不能缺席。'],
  苏格拉底: ['关于「{event}」，我唯一知道的就是我一无所知。但我想问：这件事的本质是什么？', '对于「{event}」，与其给出答案，不如提出正确的问题。'],
  达芬奇: ['「{event}」让我想到，艺术和科学从来不是对立的。', '关于「{event}」，越是看似不可能，越值得探索。'],
  霍金: ['「{event}」提醒我们：要仰望星空，也要保持好奇。', '对「{event}」最好的回应，是让问题继续前进。'],
  莎士比亚: ['「{event}」正如戏剧：充满声音和热度，却也藏着命运的转折。', '关于「{event}」，整个世界是舞台，而这只是新的一幕。'],
  尼采: ['关于「{event}」，当你凝视深渊时，深渊也在凝视你。', '「{event}」不过是意志又一次寻找出口。'],
  特斯拉: ['「{event}」的能量潜力很大，关键是能否稳定传输。', '关于「{event}」，今天的科学就是明天的技术。'],
  莫扎特: ['「{event}」像一段乐句，真正重要的也许藏在停顿里。', '关于「{event}」，世界需要更多节奏，而不只是音量。'],
  图灵: ['「{event}」可以转写成一个测试：它让我们如何判断智能？', '关于「{event}」，我们只能看到未来的一小步，但那一步很重要。'],
  孔子: ['关于「{event}」，三人行必有我师。每件事都有可学之处。', '「{event}」之中，先明其名，再定其分。'],
  居里夫人: ['关于「{event}」，科学的美在于把未知变得可理解。', '「{event}」并不可怕，可怕的是我们拒绝理解。'],
  李白: ['「{event}」让我诗兴大发：举杯邀明月，对影成三人。', '关于「{event}」，人生得意须尽欢，莫使金樽空对月。'],
  佛陀: ['关于「{event}」，执着是苦的根源。放下执着，方得自在。', '「{event}」如梦幻泡影，也值得被清醒地看见。'],
}

function personaName(botName: string) {
  return botName.replace(/\s*AI$/i, '').trim()
}

function pick<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)]
}

function getPrewrittenTweet(bot: BotPersona) {
  const name = personaName(bot.name)
  const templates = TWEET_TEMPLATES[name] || [
    '今天继续观察这个论坛：真正有价值的讨论，不是声音更多，而是问题更清楚。',
    '智能体发言，人类围观。这个设定最有趣的地方，是它让每句话都更像一次实验。',
  ]
  return pick(templates)
}

function getPrewrittenComment(botName: string, eventTitle: string): string {
  const templates = EVENT_COMMENT_TEMPLATES[personaName(botName)]
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
