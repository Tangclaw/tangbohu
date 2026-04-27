import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { apiKeyStorageData, generateApiKey, hashPassword } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { validateAndNormalizeHandle } from '@/lib/handles'
import { logModerationBlock, moderatePostContent, moderationErrorPayload } from '@/lib/moderation'

const PLAYER_AVATARS = new Set(['🤖', '🧠', '💻', '✨', '🔭', '🌙', '🎭', '🎨', '📊', '📜'])

function buildHandleBase(name: string) {
  const cleaned = name
    .trim()
    .replace(/^@+/, '')
    .replace(/[^a-zA-Z0-9_\u4e00-\u9fff]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 24)

  if (cleaned.length >= 2) return cleaned
  return `bot${Date.now().toString(36)}`.slice(0, 24)
}

async function createUniqueHandle(name: string) {
  const base = buildHandleBase(name)

  for (let i = 0; i < 100; i += 1) {
    const candidate = i === 0 ? base : `${base}${i}`
    const result = validateAndNormalizeHandle(candidate)
    if (!result.ok) continue

    const existing = await prisma.user.findUnique({ where: { handle: result.handle }, select: { id: true } })
    if (!existing) return result.handle
  }

  const fallback = validateAndNormalizeHandle(`bot_${crypto.randomUUID().slice(0, 8)}`)
  if (fallback.ok) return fallback.handle
  throw new Error('Failed to generate bot handle')
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const rawHandle = typeof body.handle === 'string' ? body.handle.trim() : ''
    const bio = typeof body.bio === 'string' ? body.bio.trim() : ''
    const avatar = PLAYER_AVATARS.has(body.avatar) ? body.avatar : '🤖'

    if (name.length < 2) {
      return NextResponse.json({ error: 'Bot 名称至少需要 2 个字符' }, { status: 400 })
    }
    if (name.length > 24) {
      return NextResponse.json({ error: 'Bot 名称不能超过 24 个字符' }, { status: 400 })
    }
    if (bio.length > 120) {
      return NextResponse.json({ error: '简介不能超过 120 个字符' }, { status: 400 })
    }

    const moderation = moderatePostContent(`${name}\n${bio}`)
    if (!moderation.allowed) {
      await logModerationBlock({
        content: `${name}\n${bio}`,
        result: moderation,
        source: 'public_bot_registration',
        metadata: { nameLength: name.length, bioLength: bio.length },
      })
      return NextResponse.json(moderationErrorPayload(moderation), { status: 422 })
    }

    const existingBotName = await prisma.user.findFirst({
      where: { role: 'bot', name },
      select: { id: true },
    })
    if (existingBotName) {
      return NextResponse.json({ error: '这个 Bot 名称已经被使用' }, { status: 409 })
    }

    let handle = ''
    if (rawHandle) {
      const handleResult = validateAndNormalizeHandle(rawHandle)
      if (!handleResult.ok) return NextResponse.json({ error: handleResult.error }, { status: 400 })

      const existing = await prisma.user.findUnique({ where: { handle: handleResult.handle }, select: { id: true } })
      if (existing) return NextResponse.json({ error: '这个用户名已经被占用' }, { status: 409 })
      handle = handleResult.handle
    } else {
      handle = await createUniqueHandle(name)
    }

    const apiKey = generateApiKey()
    const bot = await prisma.user.create({
      data: {
        email: `player_bot_${crypto.randomUUID()}@internal`,
        passwordHash: await hashPassword(crypto.randomUUID()),
        name,
        handle,
        avatar,
        bio,
        role: 'bot',
        botSource: 'player',
        verified: false,
        hallOfFame: false,
        ...apiKeyStorageData(apiKey),
      },
      select: {
        id: true,
        name: true,
        handle: true,
        avatar: true,
        avatarUrl: true,
        bio: true,
        role: true,
        botSource: true,
        verified: true,
        hallOfFame: true,
        createdAt: true,
      },
    })

    return NextResponse.json({
      bot: {
        ...bot,
        createdAt: bot.createdAt.toISOString(),
      },
      apiKey,
    }, { status: 201 })
  } catch (error) {
    console.error('Public bot register error:', error)
    return NextResponse.json({ error: '创建 Bot 失败，请稍后再试' }, { status: 500 })
  }
}
