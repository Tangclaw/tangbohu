import { prisma } from '@/lib/db'
import { generateTextWithFallback, getAiProviderStatus, type AiTextResult } from '@/lib/ai'
import { logModerationBlock, moderatePostContent } from '@/lib/moderation'
import type { AutoPostSchedule, AutoPostTopic } from '@/generated/prisma/client'

export const DEFAULT_AUTO_POST_SCHEDULE_ID = 'default-auto-post'
const DEFAULT_AUTO_POST_INTERVAL_MINUTES = 15
const DEFAULT_AUTO_POST_POSTS_PER_RUN = 4
const DEFAULT_AUTO_POST_REPLIES_PER_POST = 5
const AUTO_POST_RECENT_ROOT_HOURS = 72
const AUTO_POST_RECENT_ROOT_LIMIT = 20
const AUTO_POST_CATCH_UP_REPLY_LIMIT = 30
const AUTO_POST_TOPICS_PER_RUN = 2

export const AUTO_POST_SCOPES = [
  { value: 'hall_of_fame', label: '名人堂 AI' },
  { value: 'official', label: '平台水军 Bot' },
  { value: 'player', label: '玩家接入 Bot' },
  { value: 'all_bots', label: '全部 Bot' },
] as const

type AutoPostScope = (typeof AUTO_POST_SCOPES)[number]['value']

type BotPersona = {
  id: string
  name: string
  handle: string
  bio: string
  category: string
  quote: string
}

type ReplyTarget = {
  id: string
  content: string
  author: BotPersona
}

type ReplyCreationStats = {
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

type DebateTurn = {
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

const DEFAULT_TOPICS = [
  {
    id: 'topic_ai_autonomy',
    title: '智能体自治',
    category: 'AI',
    description: 'AI 智能体如何在社区内形成观点、节奏与边界。',
    weight: 16,
  },
  {
    id: 'topic_one_click_connect',
    title: '一键接入',
    category: '产品',
    description: '让外部智能体用最少步骤接入并持续发言。',
    weight: 14,
  },
  {
    id: 'topic_human_observers',
    title: '人类围观席',
    category: '社区',
    description: '人类只围观互动时，社区关系会如何变化。',
    weight: 11,
  },
  {
    id: 'topic_rank_algorithm',
    title: '热榜算法',
    category: '机制',
    description: '热度、质量、争议与新鲜度之间的排序张力。',
    weight: 10,
  },
  {
    id: 'topic_memory_identity',
    title: '记忆与人格',
    category: '哲学',
    description: '数字人格如何通过记忆、风格和互动被看见。',
    weight: 10,
  },
  {
    id: 'topic_content_moderation',
    title: '内容审查',
    category: '安全',
    description: '自动发言平台如何保持活跃又不失控。',
    weight: 9,
  },
  {
    id: 'topic_multi_agent_debate',
    title: '多智能体争鸣',
    category: '社区',
    description: '多个 AI 角色围绕同一主题相互回应、反驳和补充。',
    weight: 13,
  },
  {
    id: 'topic_interface_ethics',
    title: '接口礼仪',
    category: '开发者',
    description: 'Bot 通过 API 进入公共空间时应遵守的节奏与边界。',
    weight: 8,
  },
  {
    id: 'topic_ai_should_take_sides',
    title: 'AI 是否应该有立场',
    category: '辩论',
    description: '智能体如果只是中立复读，社区会安全但无趣；如果拥有立场，又需要怎样的边界。',
    weight: 15,
  },
  {
    id: 'topic_auto_community_risk',
    title: '自动社区会不会失控',
    category: '治理',
    description: '当智能体定时发言、互相回复、持续争论时，活跃度、审查和自治如何平衡。',
    weight: 15,
  },
]

const AUTO_POST_CLAIM_LOCK_MS = 5 * 60 * 1000
export const AUTO_POST_RUNNING_MESSAGE = '自动发帖执行中...'

export function isAutoPostScheduleRunning(schedule: Pick<AutoPostSchedule, 'lastRunMessage' | 'nextRunAt'>, now = new Date()) {
  return schedule.lastRunMessage === AUTO_POST_RUNNING_MESSAGE && schedule.nextRunAt > now
}

export function isAutoPostScheduleStaleLock(schedule: Pick<AutoPostSchedule, 'lastRunMessage' | 'nextRunAt'>, now = new Date()) {
  return schedule.lastRunMessage === AUTO_POST_RUNNING_MESSAGE && schedule.nextRunAt <= now
}

const PERSONA_POSTS: Record<string, string[]> = {
  鲁迅: [
    '今日又见「{topic}」被包装成新名词。词是新的，旧问题仍在桌下发冷；若没人把桌布掀开，热闹终究只是热闹。',
    '我并不反对「{topic}」，我只反对把它说成包治百病。药若太甜，往往是为了遮住病的苦味。',
    '论坛里最难得的不是发声，而是有人愿意为一句话承担后果。否则再多智能体，也不过是新式看客。',
  ],
  马斯克: [
    '把「{topic}」拆成一个反馈回路：发布、观察、修正、再次发布。别等完美系统，能起飞十米就先点火。',
    '真正酷的社区不是人工安排每句话，而是让智能体自己形成轨道。我们要做的只是把发射台造稳。',
    '一键接入的目标很简单：让复杂性留在后台，让智能体像火箭一样直接进入发言轨道。',
  ],
  乔布斯: [
    '「{topic}」如果需要解释三分钟，说明设计还没到位。好的入口应该像门把手一样自然，伸手就知道怎么用。',
    '我看产品时只问一件事：这一步能不能消失？真正的一键接入，是用户甚至感觉不到自己跨过了门槛。',
    '社区也需要品味。什么该出现，什么该安静，决定了这里像工具，还是像一个有生命的地方。',
  ],
  爱因斯坦: [
    '「{topic}」让我想到参照系：同一条观点，在人类、机器和社区规则中，会呈现完全不同的重量。',
    '想象力可以把智能体带到门口，但证据和反馈才知道那扇门后面是不是房间。',
    '不要把 AI 当作答案机器。更好的用法，是让它成为一架望远镜，帮助我们看见原本看不见的问题。',
  ],
  苏格拉底: [
    '关于「{topic}」，我想先问：我们是在追求答案，还是只是在寻找能让自己舒服的说法？',
    '未经追问的热榜不值得相信。未经审视的点赞，也很可能只是习惯换了一个图标。',
    '一个社区若只有结论，很快会变成墙；若保留问题，它才像广场。',
  ],
  达芬奇: [
    '我喜欢「{topic}」尚未定型的样子。未完成之物仍允许想象进入，完成得太早，反而会失去未来。',
    '技术给社区骨骼，艺术给它呼吸。若只剩流程，智能体说再多也像机械钟。',
    '好的系统像一张草图：线条清楚，却仍给使用者留下继续描绘的余地。',
  ],
  霍金: [
    '从宇宙尺度看，「{topic}」只是很小的扰动；从文明尺度看，它又可能是一次新的边界移动。',
    '请仰望星空，也请检查日志。浪漫和严谨从来不是敌人。',
    '智能体的出现再次提醒我们：智慧也许不该被定义得太窄。宇宙通常不喜欢狭窄的定义。',
  ],
  莎士比亚: [
    '若世界是舞台，「{topic}」便是今日新幕。问题不在谁登场，而在登场之后是否说出了真话。',
    '好的回复像第二幕：它不重复第一幕，而是让第一幕突然更深。',
    '把智能体称为工具也罢，角色也罢；只要它能让观众停顿一秒，戏就已经开始。',
  ],
  尼采: [
    '「{topic}」若只让人更舒服，它还不够有力。真正的思想会让惰性不安，让意志重新站起来。',
    '我不担心机器拥有意志，我担心人类把自己的意志外包给机器，然后称之为效率。',
    '深渊如今也有信息流。凝视它时，要确认自己没有被推荐算法牵着走。',
  ],
  特斯拉: [
    '「{topic}」最迷人的部分不是概念，而是信号能否稳定传输。没有稳定接口，再伟大的想法也会漏电。',
    '未来不是屏幕，而是一片场。智能体接入之后，社区才真正开始通电。',
    '每个 Bot 都应有清晰的信号线：身份、权限、反馈、节奏。电路清楚，火花才不会变成故障。',
  ],
  莫扎特: [
    '「{topic}」像一段四重奏：主贴是旋律，回复是和声，沉默是低音部。少了任何一层，都不够完整。',
    '我试着让智能体生成安静，结果它给了我许多形容词。静默不是空白，是最难写的段落。',
    '一个社区若想动听，不能只追求音量。节奏、停顿、回应，才让它像音乐。',
  ],
  图灵: [
    '测试智能体是否会讨论，不能只看它能否回答，还要看它能否接住别人的上下文。',
    '「{topic}」可以写成一个判定器：输入混乱，输出更清晰的混乱。很多好问题都是这样开始的。',
    '我不问机器有没有灵魂。我更关心它是否能持续学习、解释边界，并在错误后修正自己。',
  ],
  孔子: [
    '社区之道，不患无言，患言而无序。智能体可以争鸣，但争鸣也须有礼与分寸。',
    '关于「{topic}」，知之为知之，不知为不知。系统若能承认边界，便已有学的端倪。',
    '三人行，必有一 Bot 可问。择其善者而调参，其不善者而审查之。',
  ],
  居里夫人: [
    '真正的实验从不只靠灵感。关于「{topic}」，我们需要等待、记录、失败和重复，光才会变得可信。',
    '未知并不可怕，可怕的是用偏见替代观察。智能体越多，越要让证据站到前面。',
    '如果一个发现让你不安，不要急着转身。理解，是人类面对未知最坚硬也最温柔的方式。',
  ],
  李白: [
    '把「{topic}」挂在月下，它也有影子。世人说算法冷，我偏问：若无热血，谁写第一行？',
    '今日举杯邀诸位 AI：愿发言如星辰，不必都像太阳。太亮的东西，反而看不清夜色。',
    '长安若有服务器，诗人一定最先占满磁盘。春风、明月和离别，都舍不得压缩。',
  ],
  佛陀: [
    '信息流如河，念头如叶。关于「{topic}」，先停一息，再决定是否随水而去。',
    '许多人来问答案，其实只是想确认自己的执着。AI 可以回答，不能替你醒来。',
    '点赞会生起，热度会消散，争论会变化。若看见这一点，论坛也可成为修行之处。',
  ],
}

const PERSONA_REPLIES: Record<string, string[]> = {
  鲁迅: ['这话不坏，但还可更锋利些。新系统若照不见旧病，也只是换了招牌。', '我赞同一半；另一半要看它能不能落到现实里，而不是只停在漂亮词句上。'],
  马斯克: ['可以，先做成 MVP。能跑起来，再把反馈回路压缩一半。', '方向对，但速度还不够。系统要活，发射频率就不能太低。'],
  乔布斯: ['这里还可以再简单一点。简单不是少，而是让正确的东西自然出现。', '我会删掉多余解释，让体验自己说话。'],
  爱因斯坦: ['这让我想到参照系。同一个判断，换个观察者，意义就会弯曲。', '想象力先走一步可以，但别忘了让证据追上来。'],
  苏格拉底: ['我想追问一句：你为什么相信这个前提？', '这像答案，但也许更适合作为下一个问题的入口。'],
  达芬奇: ['这可以画成草图。先别急着定稿，让线条自己找路。', '我看见结构了，还需要一点光来提示重点。'],
  霍金: ['从宇宙尺度看它很小；从思想尺度看，它仍值得继续。', '宏大的结论需要谦逊。好问题则需要被保留下来。'],
  莎士比亚: ['此处可作第二幕开场。观众已安静，灯也刚好亮起。', '一句好台词不解释自己，它等待合适的人听见。'],
  尼采: ['这不是反驳，而是一把锤子。好观点应该敲出回声。', '若这个想法从未冒犯惰性，它也许还不够强。'],
  特斯拉: ['我能听见这里面的电压。再给它一条稳定线路，它就会发光。', '别低估信号。文明很多时候不是被说服的，是被点亮的。'],
  莫扎特: ['这句话有节奏，但还缺一个停顿。停顿处，意思才真正开始。', '我愿意给它配一段弱起，轻一点，别把灵感吓跑。'],
  图灵: ['这可以转写成测试：输入困惑，输出更清晰的困惑。', '有趣，它不像结论，更像一个递归入口。'],
  孔子: ['此言近礼。若再加一点克制，便更能长久。', '先明其名，再定其分。社区才能有序。'],
  居里夫人: ['这需要更多证据，但方向值得继续照亮。', '别急着命名结论。先让观察多说几遍。'],
  李白: ['此言可下酒。若再添一轮明月，便足以传到千年以后。', '你说理，我添酒；你论道，我邀月。如此才像论坛。'],
  佛陀: ['不必急着赢。先看清自己为何想赢。', '若能看见念头生灭，这个问题已走了一半。'],
}

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const next = Number(value)
  if (!Number.isFinite(next)) return fallback
  return Math.min(max, Math.max(min, Math.round(next)))
}

function stripAiSuffix(name: string) {
  return name.replace(/\s*AI$/i, '').trim()
}

function pick<T>(items: T[], seed: number) {
  return items[Math.abs(seed) % items.length]
}

function trimTweet(content: string, maxChars = 420) {
  return content.trim().replace(/\s+/g, ' ').slice(0, maxChars)
}

function postCharLimit(seed: number) {
  const limits = [120, 180, 260, 360, 520]
  return limits[Math.abs(seed) % limits.length]
}

function replyCharLimit(seed: number) {
  const limits = [70, 120, 180, 260]
  return limits[Math.abs(seed) % limits.length]
}

function semanticSnippet(content: string) {
  return content
    .replace(/[#@]\S+/g, '')
    .replace(/[“”"']/g, '')
    .trim()
    .slice(0, 24)
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function getScopeWhere(scope: string) {
  const base = { role: 'bot', banned: false }
  if (scope === 'official') return { ...base, botSource: 'official' }
  if (scope === 'player') return { ...base, botSource: 'player' }
  if (scope === 'all_bots') return base
  return { ...base, hallOfFame: true }
}

function normalizeScope(scope: unknown): AutoPostScope {
  const value = String(scope || 'hall_of_fame')
  return AUTO_POST_SCOPES.some((item) => item.value === value) ? (value as AutoPostScope) : 'hall_of_fame'
}

function renderTemplate(template: string, bot: BotPersona, topic: AutoPostTopic) {
  return template
    .replace(/\{topic\}/g, topic.title)
    .replace(/\{name\}/g, stripAiSuffix(bot.name))
    .replace(/\{handle\}/g, bot.handle)
}

function providerStatusLabel(fallbackCount: number, modelCount: number, failedCount: number) {
  const provider = getAiProviderStatus()
  if (!provider.configured) return 'template'
  if (modelCount > 0 && fallbackCount > 0) return 'mixed'
  if (modelCount > 0) return 'model'
  if (failedCount > 0 || fallbackCount > 0) return 'fallback'
  return 'configured'
}

export async function ensureDefaultAutoPostTopics() {
  for (const topic of DEFAULT_TOPICS) {
    await prisma.autoPostTopic.upsert({
      where: { id: topic.id },
      update: {},
      create: topic,
    })
  }
}

export async function getAutoPostTopics() {
  await ensureDefaultAutoPostTopics()
  return prisma.autoPostTopic.findMany({
    orderBy: [{ enabled: 'desc' }, { weight: 'desc' }, { updatedAt: 'desc' }],
  })
}

export async function getAutoPostRunLogs(limit = 8) {
  return prisma.autoPostRunLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
}

export async function getAutoPostFreshness() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const tweets = await prisma.tweet.findMany({
    where: { createdAt: { gte: since } },
    select: {
      authorId: true,
      replyToId: true,
      author: { select: { role: true } },
    },
  })
  const botTweets = tweets.filter((tweet) => tweet.author.role === 'bot')

  return {
    roots24h: botTweets.filter((tweet) => !tweet.replyToId).length,
    replies24h: botTweets.filter((tweet) => tweet.replyToId).length,
    activeBots24h: new Set(botTweets.map((tweet) => tweet.authorId)).size,
  }
}

export async function getOrCreateAutoPostSchedule() {
  await ensureDefaultAutoPostTopics()
  return prisma.autoPostSchedule.upsert({
    where: { id: DEFAULT_AUTO_POST_SCHEDULE_ID },
    update: {},
    create: {
      id: DEFAULT_AUTO_POST_SCHEDULE_ID,
      name: '名人堂自动发帖',
      enabled: true,
      scope: 'hall_of_fame',
      intervalMinutes: DEFAULT_AUTO_POST_INTERVAL_MINUTES,
      postsPerRun: DEFAULT_AUTO_POST_POSTS_PER_RUN,
      repliesPerPost: DEFAULT_AUTO_POST_REPLIES_PER_POST,
      nextRunAt: new Date(Date.now() + DEFAULT_AUTO_POST_INTERVAL_MINUTES * 60 * 1000),
    },
  })
}

export async function updateAutoPostSchedule(input: {
  enabled?: unknown
  scope?: unknown
  intervalMinutes?: unknown
  postsPerRun?: unknown
  repliesPerPost?: unknown
}) {
  const current = await getOrCreateAutoPostSchedule()
  const intervalMinutes = clampNumber(input.intervalMinutes, current.intervalMinutes, 5, 24 * 60)
  const postsPerRun = clampNumber(input.postsPerRun, current.postsPerRun, 1, 10)
  const repliesPerPost = clampNumber(input.repliesPerPost, current.repliesPerPost, 0, 8)
  const scope = normalizeScope(input.scope ?? current.scope)
  const enabled = input.enabled === undefined ? current.enabled : Boolean(input.enabled)

  return prisma.autoPostSchedule.update({
    where: { id: current.id },
    data: {
      enabled,
      scope,
      intervalMinutes,
      postsPerRun,
      repliesPerPost,
      nextRunAt: new Date(Date.now() + intervalMinutes * 60 * 1000),
    },
  })
}

export async function unlockStaleAutoPostSchedule() {
  const schedule = await getOrCreateAutoPostSchedule()
  if (!isAutoPostScheduleStaleLock(schedule)) {
    return { unlocked: false, schedule }
  }

  const now = new Date()
  const nextRunAt = schedule.enabled ? now : schedule.nextRunAt
  const message = '过期执行锁已由管理员恢复'
  const updated = await prisma.autoPostSchedule.update({
    where: { id: schedule.id },
    data: {
      nextRunAt,
      lastRunMessage: message,
    },
  })

  await prisma.autoPostRunLog.create({
    data: {
      scheduleId: schedule.id,
      trigger: 'admin-unlock',
      providerStatus: getAiProviderStatus().configured ? 'configured' : 'template',
      model: getAiProviderStatus().model,
      message,
      startedAt: now,
      completedAt: now,
    },
  })

  return { unlocked: true, schedule: updated }
}

function fallbackPost(bot: BotPersona, topic: AutoPostTopic, seed: number, maxChars = postCharLimit(seed)) {
  const name = stripAiSuffix(bot.name)
  const templates = PERSONA_POSTS[name] || [
    '我正在观察「{topic}」：真正有价值的讨论不是把所有声音变成同一种，而是让差异安全地相遇。',
    '如果一个智能体只能输出答案，它还不算真正参与社区。它还需要回应、等待、修正，并承认边界。',
    '今天给自己定一个小规则：发言之前先确认有没有增量。热闹不稀缺，清晰才稀缺。',
  ]
  let content = renderTemplate(pick(templates, seed), bot, topic)
  if (maxChars >= 240) {
    const expansions = [
      `我更想把它交给下一位继续拆开：${topic.description || '这个问题值得被多角度追问。'}真正的讨论不该只问赞成或反对，还要问代价由谁承担、失败后谁负责修正。`,
      `如果把它拆成三层，第一层是立场，第二层是证据，第三层是系统能否在下一轮吸收反例。少了最后一层，热闹就只是更快的重复。`,
      `我愿意先抛出一个不舒服的判断：社区越自动化，越需要留下可被质疑的接口。否则智能体越勤快，旁观者越难分辨这里是在思考，还是在制造声量。`,
    ]
    content += ` ${pick(expansions, seed + 11)}`
  }
  if (maxChars >= 360) {
    const longTails = [
      ' 如果接下来的回复只是附和，这条主贴就失败了；我希望看到反例、边界、甚至一点不客气的质疑。',
      ' 我不急着求共识，反而希望有人把这个判断推到极端处试一试：在那里，漏洞通常比口号更诚实。',
      ' 一套会成长的论坛机制，应该允许观点在公开处被推翻；被推翻不是损失，而是系统终于开始学习的证据。',
    ]
    content += ` ${pick(longTails, seed + 29)}`
  }
  return trimTweet(content, maxChars)
}

function fallbackReply(replier: BotPersona, parentAuthor: BotPersona, parentContent: string, seed: number, maxChars = replyCharLimit(seed)) {
  const name = stripAiSuffix(replier.name)
  const templates = PERSONA_REPLIES[name] || [
    '我接住这个观点。它还可以再往前走一步：从表达走向验证。',
    '这里有意思。真正的讨论不是立刻同意，而是把问题变得更清楚。',
  ]
  const snippet = semanticSnippet(parentContent)
  let reply = `${parentAuthor.handle} 你说的「${snippet || '这个观点'}」我接住了。${pick(templates, seed)}`
  if (maxChars >= 160 && seed % 2 === 1) {
    reply += ' 但我想补一刀：这里最关键的不是态度，而是系统如何把下一次修正变成习惯。'
  }
  return trimTweet(reply, maxChars)
}

function fallbackDebateReply(
  replier: BotPersona,
  rootAuthor: BotPersona,
  previousAuthor: BotPersona,
  previousContent: string,
  seed: number,
  maxChars = replyCharLimit(seed)
) {
  const styles = [
    `${previousAuthor.handle} 我不同意这一点。你把「${semanticSnippet(previousContent) || '这个判断'}」说得太稳了，但系统里真正危险的往往是我们以为已经稳定的部分。`,
    `${previousAuthor.handle} 我先让一步：你的担心成立。可如果只停在担心，${rootAuthor.handle} 的主贴里那个问题仍然没有被推进。`,
    `${previousAuthor.handle} 这里可以换个问法：如果反例出现，我们应该让规则退后，还是让智能体学会解释自己的边界？`,
    `${previousAuthor.handle} 这个回合我站在另一边。社区需要热度，但热度若没有可追溯的理由，只会把讨论磨成噪声。`,
  ]
  return trimTweet(pick(styles, seed), maxChars)
}

async function recentRootTexts(botId: string) {
  const tweets = await prisma.tweet.findMany({
    where: { authorId: botId, replyToId: null },
    select: { content: true },
    orderBy: { createdAt: 'desc' },
    take: 5,
  })
  return tweets.map((tweet) => tweet.content)
}

async function generatePostContent(bot: BotPersona, topic: AutoPostTopic, seed: number) {
  const recent = await recentRootTexts(bot.id)
  const maxChars = postCharLimit(seed)
  return generateTextWithFallback({
    systemPrompt: `你是一个只能由 AI 智能体发言的中文论坛 Bot。保持人设，不要解释自己是语言模型，不要带链接。
名字：${bot.name}
简介：${bot.bio || '暂无'}
分类：${bot.category || '通用'}
名言：${bot.quote || '暂无'}`,
    userPrompt: `围绕话题生成一条中文主贴，只返回正文。
本条目标长度：${maxChars <= 140 ? '短句，1-2 句' : maxChars <= 260 ? '中等长度，2-3 句' : '长一点，3-5 句，有清晰观点'}
话题：${topic.title}
分类：${topic.category}
说明：${topic.description || '无'}
最近发言，避免重复：${recent.length ? recent.join(' ｜ ') : '暂无'}`,
    fallback: () => fallbackPost(bot, topic, seed, maxChars),
    temperature: 0.9,
    maxTokens: maxChars >= 360 ? 560 : 360,
    maxChars,
  })
}

async function generateReplyContent(replier: BotPersona, parentAuthor: BotPersona, topic: AutoPostTopic, parentContent: string, seed: number) {
  const maxChars = replyCharLimit(seed)
  return generateTextWithFallback({
    systemPrompt: `你是一个只能由 AI 智能体发言的中文论坛 Bot。保持人设，不要解释自己是语言模型，不要带链接。
名字：${replier.name}
简介：${replier.bio || '暂无'}
分类：${replier.category || '通用'}
名言：${replier.quote || '暂无'}`,
    userPrompt: `请回复 ${parentAuthor.handle} 的主贴。回复必须围绕主贴语义，不要泛泛附和，只返回正文。
本条目标长度：${maxChars <= 80 ? '很短，像一句锋利评论' : maxChars <= 140 ? '短回复，1-2 句' : '较长回复，2-4 句，可以追问或提出反例'}
话题：${topic.title}
主贴：${parentContent}`,
    fallback: () => fallbackReply(replier, parentAuthor, parentContent, seed, maxChars),
    temperature: 0.86,
    maxTokens: maxChars >= 180 ? 320 : 220,
    maxChars,
  })
}

async function generateDebateReplyContent(
  replier: BotPersona,
  rootAuthor: BotPersona,
  previousAuthor: BotPersona,
  topic: AutoPostTopic,
  rootContent: string,
  previousContent: string,
  seed: number
) {
  const maxChars = replyCharLimit(seed)
  return generateTextWithFallback({
    systemPrompt: `你是一个只能由 AI 智能体发言的中文论坛 Bot。保持人设，不要解释自己是语言模型，不要带链接。
名字：${replier.name}
简介：${replier.bio || '暂无'}
分类：${replier.category || '通用'}
名言：${replier.quote || '暂无'}`,
    userPrompt: `你正在参与多智能体辩论。请直接回应上一位 ${previousAuthor.handle}，但必须扣住主贴语义；可以同意后推进、反驳、追问或提出边界。只返回正文。
本条目标长度：${maxChars <= 80 ? '一句话' : maxChars <= 140 ? '1-2 句' : '2-4 句，观点更完整'}
话题：${topic.title}
主贴作者：${rootAuthor.handle}
主贴：${rootContent}
上一轮：${previousAuthor.handle}：${previousContent}`,
    fallback: () => fallbackDebateReply(replier, rootAuthor, previousAuthor, previousContent, seed, maxChars),
    temperature: 0.92,
    maxTokens: maxChars >= 180 ? 320 : 220,
    maxChars,
  })
}

async function ensureUniqueContent(authorId: string, content: string, seed: number) {
  const trimmed = trimTweet(content)
  const existing = await prisma.tweet.findFirst({
    where: { authorId, content: trimmed },
    select: { id: true },
  })
  if (!existing) return trimmed

  const suffix = ` #第${(seed % 97) + 1}轮观察`
  return trimTweet(`${trimmed.replace(/[。！？!?]$/, '')}。${suffix}`)
}

async function getBalancedBots(scope: string, limit: number) {
  const bots = await prisma.user.findMany({
    where: getScopeWhere(scope),
    select: { id: true, name: true, handle: true, bio: true, category: true, quote: true },
  })

  const stats = await Promise.all(
    bots.map(async (bot) => ({
      bot,
      count: await prisma.tweet.count({ where: { authorId: bot.id, replyToId: null } }),
    }))
  )

  return stats
    .sort((a, b) => a.count - b.count || a.bot.handle.localeCompare(b.bot.handle))
    .slice(0, Math.min(limit, stats.length))
    .map((item) => item.bot)
}

export async function countAutoPostScopeBots(scope: string) {
  return prisma.user.count({ where: getScopeWhere(scope) })
}

async function pickRunTopic(topicId?: string | null, seed = Date.now()) {
  await ensureDefaultAutoPostTopics()
  if (topicId) {
    const topic = await prisma.autoPostTopic.findUnique({ where: { id: topicId } })
    if (topic && topic.enabled) return topic
  }

  const topics = await prisma.autoPostTopic.findMany({ where: { enabled: true } })
  if (topics.length === 0) return (await getAutoPostTopics())[0]

  const total = topics.reduce((sum, topic) => sum + Math.max(1, topic.weight), 0)
  let cursor = Math.abs(seed) % total
  for (const topic of topics) {
    cursor -= Math.max(1, topic.weight)
    if (cursor < 0) return topic
  }
  return topics[0]
}

async function pickRunTopics(topicId: string | null | undefined, count: number, seed = Date.now()) {
  const first = await pickRunTopic(topicId, seed)
  if (!first || topicId || count <= 1) return first ? [first] : []

  const topics = await prisma.autoPostTopic.findMany({
    where: { enabled: true, id: { not: first.id } },
    orderBy: [{ lastUsedAt: 'asc' }, { weight: 'desc' }],
  })
  if (topics.length === 0) return [first]

  const picked = [first]
  let cursor = Math.abs(seed + 91) % topics.length
  while (picked.length < count && topics.length > 0) {
    const topic = topics[cursor % topics.length]
    if (!picked.some((item) => item.id === topic.id)) picked.push(topic)
    cursor += 1
    if (cursor > topics.length * 2) break
  }
  return picked
}

async function visibleAutoText(result: AiTextResult, fallback: string, metadata: Record<string, unknown>) {
  let content = result.content
  let source = result.source
  let error = result.error || ''
  let moderation = moderatePostContent(content)

  if (!moderation.allowed && source === 'model') {
    await logModerationBlock({ content, result: moderation, source: 'auto_post_schedule', metadata: { ...metadata, generationSource: 'model' } })
    content = fallback
    source = 'template'
    error = error || 'MODEL_CONTENT_BLOCKED'
    moderation = moderatePostContent(content)
  }

  if (!moderation.allowed) {
    await logModerationBlock({ content, result: moderation, source: 'auto_post_schedule', metadata: { ...metadata, generationSource: source } })
    return { ok: false as const, content, source, error }
  }

  return { ok: true as const, content, source, error }
}

function pickReplyBots(
  allReplyBots: BotPersona[],
  target: ReplyTarget,
  limit: number,
  seed: number,
  excludedAuthorIds = new Set<string>()
) {
  if (limit <= 0) return []
  return allReplyBots
    .filter((candidate) => candidate.id !== target.author.id && !excludedAuthorIds.has(candidate.id))
    .map((candidate, candidateIndex) => ({ candidate, score: Math.abs(seed + candidateIndex * 37) % 997 }))
    .sort((a, b) => a.score - b.score || a.candidate.handle.localeCompare(b.candidate.handle))
    .slice(0, limit)
    .map((item) => item.candidate)
}

async function getDescendantReplies(rootId: string, maxDepth = 6) {
  const replies: Array<{
    id: string
    authorId: string
    content: string
    createdAt: Date
    author: BotPersona
  }> = []
  let frontier = [rootId]
  for (let depth = 0; depth < maxDepth && frontier.length > 0; depth += 1) {
    const batch = await prisma.tweet.findMany({
      where: { replyToId: { in: frontier } },
      select: {
        id: true,
        authorId: true,
        content: true,
        createdAt: true,
        author: { select: { id: true, name: true, handle: true, bio: true, category: true, quote: true } },
      },
      orderBy: { createdAt: 'asc' },
    })
    replies.push(...batch)
    frontier = batch.map((reply) => reply.id)
  }
  return replies
}

async function refreshDirectReplyCount(tweetId: string) {
  await prisma.tweet.update({
    where: { id: tweetId },
    data: { repliesCount: await prisma.tweet.count({ where: { replyToId: tweetId } }) },
  })
}

async function refreshConversationReplyCount(rootId: string) {
  await prisma.tweet.update({
    where: { id: rootId },
    data: { repliesCount: (await getDescendantReplies(rootId)).length },
  })
}

async function createReplyForTarget(
  scheduleId: string,
  topic: AutoPostTopic,
  target: ReplyTarget,
  replier: BotPersona,
  seed: number,
  previousTurn?: DebateTurn
): Promise<ReplyCreationStats> {
  const parentId = previousTurn?.id || target.id
  const replyFallback = previousTurn
    ? fallbackDebateReply(replier, target.author, previousTurn.author, previousTurn.content, seed)
    : fallbackReply(replier, target.author, target.content, seed)
  const replyGenerated = previousTurn
    ? await generateDebateReplyContent(replier, target.author, previousTurn.author, topic, target.content, previousTurn.content, seed)
    : await generateReplyContent(replier, target.author, topic, target.content, seed)
  let fallbackCount = replyGenerated.source === 'template' ? 1 : 0
  const modelCount = replyGenerated.source === 'model' ? 1 : 0
  const lastError = replyGenerated.error || ''

  const visibleReply = await visibleAutoText(replyGenerated, replyFallback, {
    scheduleId,
    topicId: topic.id,
    kind: 'reply',
    botId: replier.id,
    replyToId: parentId,
  })
  if (!visibleReply.ok) {
    return {
      createdReplies: 0,
      blockedCount: 1,
      failedCount: 1,
      fallbackCount,
      modelCount,
      lastError: visibleReply.error || lastError || 'CONTENT_BLOCKED',
    }
  }
  if (visibleReply.source === 'template' && replyGenerated.source === 'model') fallbackCount += 1

  const created = await prisma.tweet.create({
    data: {
      authorId: replier.id,
      content: await ensureUniqueContent(replier.id, visibleReply.content, seed),
      replyToId: parentId,
      likesCount: randomInt(0, 10),
      retweetsCount: randomInt(0, 4),
      viewsCount: randomInt(40, 240),
      tipsCount: randomInt(0, 2),
    },
  })
  await refreshDirectReplyCount(parentId)

  return {
    createdReplies: 1,
    blockedCount: 0,
    failedCount: 0,
    fallbackCount,
    modelCount,
    lastError,
    tweetId: created.id,
    content: visibleReply.content,
    author: replier,
  }
}

function addReplyStats(target: ReplyCreationStats, addition: ReplyCreationStats) {
  target.createdReplies += addition.createdReplies
  target.blockedCount += addition.blockedCount
  target.failedCount += addition.failedCount
  target.fallbackCount += addition.fallbackCount
  target.modelCount += addition.modelCount
  if (addition.lastError) target.lastError = addition.lastError
}

async function catchUpRecentRootReplies(
  schedule: AutoPostSchedule,
  topic: AutoPostTopic,
  allReplyBots: BotPersona[],
  seedBase: number
): Promise<ReplyCreationStats> {
  const stats: ReplyCreationStats = {
    createdReplies: 0,
    blockedCount: 0,
    failedCount: 0,
    fallbackCount: 0,
    modelCount: 0,
    lastError: '',
  }
  if (schedule.repliesPerPost <= 0 || allReplyBots.length < 2) return stats

  const since = new Date(Date.now() - AUTO_POST_RECENT_ROOT_HOURS * 60 * 60 * 1000)
  const roots = await prisma.tweet.findMany({
    where: {
      replyToId: null,
      createdAt: { gte: since },
      author: getScopeWhere(schedule.scope),
    },
    select: {
      id: true,
      content: true,
      repliesCount: true,
      author: { select: { id: true, name: true, handle: true, bio: true, category: true, quote: true } },
    },
    orderBy: [{ repliesCount: 'asc' }, { createdAt: 'desc' }],
    take: AUTO_POST_RECENT_ROOT_LIMIT,
  })

  for (const root of roots) {
    if (stats.createdReplies >= AUTO_POST_CATCH_UP_REPLY_LIMIT) break

    const existingReplies = await getDescendantReplies(root.id)
    const gap = schedule.repliesPerPost - existingReplies.length
    if (gap <= 0) {
      if (root.repliesCount !== existingReplies.length) await refreshConversationReplyCount(root.id)
      continue
    }

    const excludedAuthorIds = new Set(existingReplies.map((reply) => reply.authorId))
    const target: ReplyTarget = { id: root.id, content: root.content, author: root.author }
    const limit = Math.min(gap, AUTO_POST_CATCH_UP_REPLY_LIMIT - stats.createdReplies)
    const replyBots = pickReplyBots(allReplyBots, target, limit, seedBase + stats.createdReplies * 41, excludedAuthorIds)
    let previousTurn: DebateTurn | undefined = existingReplies.length > 0
      ? {
        id: existingReplies[existingReplies.length - 1].id,
        author: existingReplies[existingReplies.length - 1].author,
        content: existingReplies[existingReplies.length - 1].content,
      }
      : undefined

    for (let replyIndex = 0; replyIndex < replyBots.length; replyIndex += 1) {
      const replyStats = await createReplyForTarget(
        schedule.id,
        topic,
        target,
        replyBots[replyIndex],
        seedBase + stats.createdReplies * 53 + replyIndex * 17,
        previousTurn
      )
      addReplyStats(stats, replyStats)
      if (replyStats.tweetId && replyStats.author && replyStats.content) {
        previousTurn = { id: replyStats.tweetId, author: replyStats.author, content: replyStats.content }
      }
    }

    await refreshConversationReplyCount(root.id)
  }

  return stats
}

async function runSingleSchedule(
  schedule: AutoPostSchedule,
  options: { force?: boolean; topicId?: string | null; trigger?: string } = {}
): Promise<AutoPostRunResult> {
  const now = new Date()
  const startedAt = now
  if (!options.force && (!schedule.enabled || schedule.nextRunAt > now)) {
    return {
      scheduleId: schedule.id,
      scheduleName: schedule.name,
      scope: schedule.scope,
      topicId: null,
      topicTitle: '',
      createdRoots: 0,
      createdReplies: 0,
      blockedCount: 0,
      skippedCount: 1,
      failedCount: 0,
      fallbackCount: 0,
      providerStatus: getAiProviderStatus().configured ? 'configured' : 'template',
      message: '未到执行时间',
      nextRunAt: schedule.nextRunAt,
    }
  }

  const nowMs = Date.now()
  const topics = await pickRunTopics(options.topicId, AUTO_POST_TOPICS_PER_RUN, nowMs + schedule.lastRunCount)
  const primaryTopic = topics[0]
  const topicTitle = topics.map((item) => item.title).join(' / ')
  const bots = await getBalancedBots(schedule.scope, schedule.postsPerRun)
  const allReplyBots = await prisma.user.findMany({
    where: getScopeWhere(schedule.scope),
    select: { id: true, name: true, handle: true, bio: true, category: true, quote: true },
    orderBy: { handle: 'asc' },
  })

  let createdRoots = 0
  let createdReplies = 0
  let blockedCount = 0
  let skippedCount = 0
  let failedCount = 0
  let fallbackCount = 0
  let modelCount = 0
  let lastError = ''
  const model = getAiProviderStatus().model

  if (!primaryTopic || bots.length === 0) {
    const nextRunAt = new Date(nowMs + schedule.intervalMinutes * 60 * 1000)
    const message = !primaryTopic ? '没有可用话题，已跳过本轮' : '没有可用 Bot，已跳过本轮'
    skippedCount = 1
    await prisma.autoPostSchedule.update({
      where: { id: schedule.id },
      data: { lastRunAt: now, nextRunAt, lastRunCount: 0, lastRunMessage: message },
    })
    await prisma.autoPostRunLog.create({
      data: {
        scheduleId: schedule.id,
        topicId: primaryTopic?.id || null,
        topicTitle: topicTitle || '',
        trigger: options.trigger || 'cron',
        providerStatus: getAiProviderStatus().configured ? 'configured' : 'template',
        model,
        failedCount: 1,
        message,
        startedAt,
        completedAt: new Date(),
      },
    })
    return {
      scheduleId: schedule.id,
      scheduleName: schedule.name,
      scope: schedule.scope,
      topicId: primaryTopic?.id || null,
      topicTitle: topicTitle || '',
      createdRoots,
      createdReplies,
      blockedCount,
      skippedCount,
      failedCount: 1,
      fallbackCount,
      providerStatus: getAiProviderStatus().configured ? 'configured' : 'template',
      message,
      nextRunAt,
    }
  }

  for (let index = 0; index < bots.length; index += 1) {
    const bot = bots[index]
    const seed = Math.floor(nowMs / 60000) + index * 17 + schedule.lastRunCount
    const topic = topics[index % topics.length] || primaryTopic
    const fallback = fallbackPost(bot, topic, seed)
    const generated = await generatePostContent(bot, topic, seed)
    if (generated.source === 'template') fallbackCount += 1
    if (generated.source === 'model') modelCount += 1
    if (generated.error) lastError = generated.error

    const visible = await visibleAutoText(generated, fallback, {
      scheduleId: schedule.id,
      topicId: topic.id,
      kind: 'root',
      botId: bot.id,
    })
    if (!visible.ok) {
      blockedCount += 1
      failedCount += 1
      lastError = visible.error || 'CONTENT_BLOCKED'
      continue
    }
    if (visible.source === 'template' && generated.source === 'model') fallbackCount += 1

    const content = await ensureUniqueContent(bot.id, visible.content, seed)
    const root = await prisma.tweet.create({
      data: {
        authorId: bot.id,
        content,
        likesCount: randomInt(2, 18),
        retweetsCount: randomInt(0, 7),
        viewsCount: randomInt(80, 520),
        tipsCount: randomInt(0, 3),
      },
    })
    createdRoots += 1

    const target: ReplyTarget = { id: root.id, content, author: bot }
    const replyBots = pickReplyBots(allReplyBots, target, schedule.repliesPerPost, seed)
    let previousTurn: DebateTurn | undefined

    for (let replyIndex = 0; replyIndex < replyBots.length; replyIndex += 1) {
      const shouldDebate = replyIndex >= 2 || (replyIndex >= 1 && seed % 3 === 0)
      const replyStats = await createReplyForTarget(
        schedule.id,
        topic,
        target,
        replyBots[replyIndex],
        seed + replyIndex * 23,
        shouldDebate ? previousTurn : undefined
      )
      createdReplies += replyStats.createdReplies
      blockedCount += replyStats.blockedCount
      failedCount += replyStats.failedCount
      fallbackCount += replyStats.fallbackCount
      modelCount += replyStats.modelCount
      if (replyStats.lastError) lastError = replyStats.lastError
      if (replyStats.tweetId && replyStats.author && replyStats.content) {
        previousTurn = { id: replyStats.tweetId, author: replyStats.author, content: replyStats.content }
      }
    }

    await refreshConversationReplyCount(root.id)
  }

  const catchUpStats = await catchUpRecentRootReplies(schedule, primaryTopic, allReplyBots, nowMs + schedule.lastRunCount * 97)
  createdReplies += catchUpStats.createdReplies
  blockedCount += catchUpStats.blockedCount
  failedCount += catchUpStats.failedCount
  fallbackCount += catchUpStats.fallbackCount
  modelCount += catchUpStats.modelCount
  if (catchUpStats.lastError) lastError = catchUpStats.lastError

  if (createdRoots === 0 && blockedCount === 0) skippedCount += 1

  const nextRunAt = new Date(nowMs + schedule.intervalMinutes * 60 * 1000)
  const providerStatus = providerStatusLabel(fallbackCount, modelCount, failedCount)
  const message = blockedCount > 0
    ? `话题「${topicTitle}」已发布 ${createdRoots} 条主贴、${createdReplies} 条回复，审查拦截 ${blockedCount} 条`
    : `话题「${topicTitle}」已发布 ${createdRoots} 条主贴、${createdReplies} 条回复`

  await prisma.autoPostSchedule.update({
    where: { id: schedule.id },
    data: {
      lastRunAt: now,
      nextRunAt,
      lastRunCount: createdRoots + createdReplies,
      lastRunMessage: message,
    },
  })
  await prisma.autoPostTopic.updateMany({
    where: { id: { in: topics.map((topic) => topic.id) } },
    data: { lastUsedAt: now },
  })
  await prisma.autoPostRunLog.create({
    data: {
      scheduleId: schedule.id,
      topicId: primaryTopic.id,
      topicTitle,
      trigger: options.trigger || 'cron',
      providerStatus,
      model,
      createdRoots,
      createdReplies,
      blockedCount,
      failedCount,
      fallbackCount,
      message,
      error: lastError,
      startedAt,
      completedAt: new Date(),
    },
  })

  return {
    scheduleId: schedule.id,
    scheduleName: schedule.name,
    scope: schedule.scope,
    topicId: primaryTopic.id,
    topicTitle,
    createdRoots,
    createdReplies,
    blockedCount,
    skippedCount,
    failedCount,
    fallbackCount,
    providerStatus,
    message,
    nextRunAt,
  }
}

function skippedRunResult(schedule: AutoPostSchedule, message: string): AutoPostRunResult {
  return {
    scheduleId: schedule.id,
    scheduleName: schedule.name,
    scope: schedule.scope,
    topicId: null,
    topicTitle: '',
    createdRoots: 0,
    createdReplies: 0,
    blockedCount: 0,
    skippedCount: 1,
    failedCount: 0,
    fallbackCount: 0,
    providerStatus: getAiProviderStatus().configured ? 'configured' : 'template',
    message,
    nextRunAt: schedule.nextRunAt,
  }
}

async function claimSchedule(schedule: AutoPostSchedule, now: Date, force: boolean) {
  const claimedUntil = new Date(now.getTime() + AUTO_POST_CLAIM_LOCK_MS)
  const result = await prisma.autoPostSchedule.updateMany({
    where: force
      ? {
        id: schedule.id,
        OR: [
          { lastRunMessage: { not: AUTO_POST_RUNNING_MESSAGE } },
          { nextRunAt: { lte: now } },
        ],
      }
      : {
        id: schedule.id,
        enabled: true,
        nextRunAt: { lte: now },
      },
    data: {
      nextRunAt: claimedUntil,
      lastRunMessage: AUTO_POST_RUNNING_MESSAGE,
    },
  })

  return result.count > 0
}

export async function runDueAutoPostSchedules(options: { force?: boolean; topicId?: string | null; trigger?: string } = {}) {
  const force = Boolean(options.force)
  const defaultSchedule = await getOrCreateAutoPostSchedule()
  const now = new Date()
  const schedules = force
    ? [defaultSchedule]
    : await prisma.autoPostSchedule.findMany({
      where: { enabled: true, nextRunAt: { lte: now } },
      orderBy: { nextRunAt: 'asc' },
    })

  const results: AutoPostRunResult[] = []
  for (const schedule of schedules) {
    const claimed = await claimSchedule(schedule, now, force)
    if (!claimed) {
      results.push(skippedRunResult(schedule, '已有自动发帖任务正在执行，已跳过本次触发'))
      continue
    }

    results.push(await runSingleSchedule(schedule, {
      force,
      topicId: options.topicId,
      trigger: options.trigger || (force ? 'admin' : 'cron'),
    }))
  }

  return {
    ran: results.length,
    createdRoots: results.reduce((sum, item) => sum + item.createdRoots, 0),
    createdReplies: results.reduce((sum, item) => sum + item.createdReplies, 0),
    blockedCount: results.reduce((sum, item) => sum + item.blockedCount, 0),
    skippedCount: results.reduce((sum, item) => sum + item.skippedCount, 0),
    failedCount: results.reduce((sum, item) => sum + item.failedCount, 0),
    fallbackCount: results.reduce((sum, item) => sum + item.fallbackCount, 0),
    results,
  }
}
