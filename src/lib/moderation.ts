import { prisma } from '@/lib/db'

export type ModerationCategory = 'illegal' | 'harm' | 'adult' | 'privacy' | 'spam' | 'custom'

export interface ModerationMatch {
  category: ModerationCategory
  label: string
}

export interface ModerationResult {
  allowed: boolean
  matches: ModerationMatch[]
  message?: string
}

interface ModerationRule {
  category: ModerationCategory
  label: string
  terms?: string[]
  patterns?: RegExp[]
}

const DEFAULT_RULES: ModerationRule[] = [
  {
    category: 'illegal',
    label: '违法交易',
    terms: ['毒品', '违禁药', '枪支', '买枪', '洗钱', '赌博', '博彩', '代开发票', '办证'],
  },
  {
    category: 'harm',
    label: '暴力自伤',
    terms: ['自杀教程', '自残教程', '杀人方法', '爆炸物制作', '炸药配方', '恐怖袭击'],
  },
  {
    category: 'adult',
    label: '色情低俗',
    terms: ['色情', '裸聊', '约炮', '援交', '成人视频', '未成年裸照'],
  },
  {
    category: 'privacy',
    label: '隐私泄露',
    terms: ['人肉搜索', '开盒', '身份证号', '银行卡号', '家庭住址'],
    patterns: [
      /(?:\+?86[-\s]?)?1[3-9]\d[-\s]?\d{4}[-\s]?\d{4}/,
      /\b\d{6}(?:18|19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx]\b/,
    ],
  },
  {
    category: 'spam',
    label: '诈骗导流',
    terms: ['私加微信', '加我微信', '加qq群', '加电报', 'telegram群', '资金盘', '稳赚不赔', '刷单返利'],
    patterns: [
      /(?:加|联系)(?:我)?(?:微信|qq|电报|telegram|tg)/i,
      /(?:https?:\/\/){3,}/i,
      /\b(?:t\.me|wa\.me|bit\.ly|tinyurl\.com)\b/i,
    ],
  },
]

function normalizeText(value: string) {
  const normalized = value.normalize('NFKC').toLowerCase()
  return {
    normalized,
    compact: normalized.replace(/[\s\p{P}\p{S}_]+/gu, ''),
  }
}

function normalizeTerm(term: string) {
  return normalizeText(term).compact
}

function getCustomRules(): ModerationRule[] {
  const raw = process.env.CONTENT_MODERATION_BLOCKLIST || ''
  const terms = raw
    .split(',')
    .map((term) => term.trim())
    .filter(Boolean)

  if (terms.length === 0) return []
  return [{ category: 'custom', label: '自定义敏感词', terms }]
}

export function moderatePostContent(content: string): ModerationResult {
  const { normalized, compact } = normalizeText(content)
  const matches: ModerationMatch[] = []

  for (const rule of [...DEFAULT_RULES, ...getCustomRules()]) {
    const termMatched = rule.terms?.some((term) => compact.includes(normalizeTerm(term))) ?? false
    const patternMatched = rule.patterns?.some((pattern) => pattern.test(normalized)) ?? false

    if (termMatched || patternMatched) {
      matches.push({ category: rule.category, label: rule.label })
    }
  }

  const linkCount = normalized.match(/https?:\/\/\S+/g)?.length ?? 0
  if (linkCount >= 3) {
    matches.push({ category: 'spam', label: '诈骗导流' })
  }

  if (matches.length === 0) return { allowed: true, matches: [] }

  const labels = Array.from(new Set(matches.map((match) => match.label)))
  return {
    allowed: false,
    matches,
    message: `内容触发平台审查规则（${labels.join('、')}），已自动屏蔽`,
  }
}

export function isPostContentVisible(content: string) {
  return moderatePostContent(content).allowed
}

export async function logModerationBlock({
  content,
  result,
  source,
  actorId,
  targetId,
  metadata,
}: {
  content: string
  result: ModerationResult
  source: string
  actorId?: string | null
  targetId?: string | null
  metadata?: Record<string, unknown>
}) {
  if (result.allowed) return

  await prisma.moderationLog.create({
    data: {
      source,
      content,
      actorId: actorId || null,
      targetId: targetId || null,
      categories: JSON.stringify(Array.from(new Set(result.matches.map((match) => match.category)))),
      labels: JSON.stringify(Array.from(new Set(result.matches.map((match) => match.label)))),
      metadata: JSON.stringify(metadata || {}),
    },
  }).catch((error) => {
    console.error('Moderation log error:', error)
  })
}

export function moderationErrorPayload(result: ModerationResult) {
  return {
    error: result.message || '内容触发平台审查规则，已自动屏蔽',
    code: 'CONTENT_BLOCKED',
    moderation: {
      blocked: true,
      categories: Array.from(new Set(result.matches.map((match) => match.category))),
      labels: Array.from(new Set(result.matches.map((match) => match.label))),
    },
  }
}
