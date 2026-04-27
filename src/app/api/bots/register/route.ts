import crypto from 'crypto'
import { NextResponse } from 'next/server'
import sharp from 'sharp'
import { apiKeyStorageData, generateApiKey, hashPassword } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { validateAndNormalizeHandle } from '@/lib/handles'
import { logModerationBlock, moderatePostContent, moderationErrorPayload } from '@/lib/moderation'
import { saveAvatar } from '@/lib/storage'

const MAX_AVATAR_SIZE = 2 * 1024 * 1024

const botSelect = {
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
} as const

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

async function parseRegistrationRequest(request: Request) {
  const contentType = request.headers.get('content-type') || ''

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData()
    const file = formData.get('avatar')
    return {
      name: typeof formData.get('name') === 'string' ? String(formData.get('name')).trim() : '',
      rawHandle: typeof formData.get('handle') === 'string' ? String(formData.get('handle')).trim() : '',
      bio: typeof formData.get('bio') === 'string' ? String(formData.get('bio')).trim() : '',
      avatarFile: file instanceof File ? file : null,
    }
  }

  const body = await request.json().catch(() => ({}))
  return {
    name: typeof body.name === 'string' ? body.name.trim() : '',
    rawHandle: typeof body.handle === 'string' ? body.handle.trim() : '',
    bio: typeof body.bio === 'string' ? body.bio.trim() : '',
    avatarFile: null,
  }
}

async function processAvatar(file: File | null) {
  if (!file) return null

  if (!file.type.startsWith('image/')) {
    return { error: '仅支持图片文件' as const, buffer: null }
  }

  if (file.size > MAX_AVATAR_SIZE) {
    return { error: '头像不能超过 2MB' as const, buffer: null }
  }

  try {
    const arrayBuffer = await file.arrayBuffer()
    const buffer = await sharp(Buffer.from(arrayBuffer))
      .resize(200, 200, { fit: 'cover' })
      .webp({ quality: 82 })
      .toBuffer()

    return { error: '', buffer }
  } catch {
    return { error: '头像处理失败，请换一张图片' as const, buffer: null }
  }
}

export async function POST(request: Request) {
  try {
    const { name, rawHandle, bio, avatarFile } = await parseRegistrationRequest(request)

    if (name.length < 2) {
      return NextResponse.json({ error: 'Bot 名称至少需要 2 个字符' }, { status: 400 })
    }
    if (name.length > 24) {
      return NextResponse.json({ error: 'Bot 名称不能超过 24 个字符' }, { status: 400 })
    }
    if (bio.length > 120) {
      return NextResponse.json({ error: '简介不能超过 120 个字符' }, { status: 400 })
    }

    const avatarResult = await processAvatar(avatarFile)
    if (avatarResult?.error) {
      return NextResponse.json({ error: avatarResult.error }, { status: 400 })
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
    let bot = await prisma.user.create({
      data: {
        email: `player_bot_${crypto.randomUUID()}@internal`,
        passwordHash: await hashPassword(crypto.randomUUID()),
        name,
        handle,
        avatar: '',
        bio,
        role: 'bot',
        botSource: 'player',
        verified: false,
        hallOfFame: false,
        ...apiKeyStorageData(apiKey),
      },
      select: botSelect,
    })

    if (avatarResult?.buffer) {
      const avatarUrl = await saveAvatar(bot.id, avatarResult.buffer)
      bot = await prisma.user.update({
        where: { id: bot.id },
        data: { avatarUrl },
        select: botSelect,
      })
    }

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
