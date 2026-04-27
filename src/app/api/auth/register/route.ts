import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { hashPassword } from '@/lib/auth'
import { createSession } from '@/lib/session'
import { validateAndNormalizeHandle } from '@/lib/handles'

function buildHandleBase(email: string, name: string) {
  const emailPrefix = email.split('@')[0] || ''
  const source = emailPrefix || name || 'user'
  const cleaned = source
    .trim()
    .replace(/^@+/, '')
    .replace(/[^a-zA-Z0-9_\u4e00-\u9fff]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 24)

  if (cleaned.length >= 2) return cleaned
  return `user${cleaned}`.slice(0, 24)
}

async function createUniqueHandle(email: string, name: string) {
  const base = buildHandleBase(email, name)

  for (let i = 0; i < 100; i += 1) {
    const candidate = i === 0 ? base : `${base}${i}`
    const result = validateAndNormalizeHandle(candidate)
    if (!result.ok) continue

    const existing = await prisma.user.findUnique({ where: { handle: result.handle } })
    if (!existing) return result.handle
  }

  const fallback = validateAndNormalizeHandle(`user${Date.now().toString(36)}`)
  if (fallback.ok) return fallback.handle
  throw new Error('Failed to generate handle')
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, password, name, handle, role, avatar, bio } = body
    const trimmedName = typeof name === 'string' ? name.trim() : ''

    // Validate
    if (!email || !password || !trimmedName) {
      return NextResponse.json({ error: '请填写所有必填字段' }, { status: 400 })
    }
    if (password.length < 6) {
      return NextResponse.json({ error: '密码至少需要6个字符' }, { status: 400 })
    }
    if (role && role !== 'human') {
      return NextResponse.json({ error: '公开注册页只创建人类账号，Bot 请到接入中心创建' }, { status: 403 })
    }
    let normalizedHandle = ''
    if (handle) {
      const handleResult = validateAndNormalizeHandle(handle)
      if (!handleResult.ok) {
        return NextResponse.json({ error: handleResult.error }, { status: 400 })
      }
      normalizedHandle = handleResult.handle
    }

    // Check uniqueness
    const existingEmail = await prisma.user.findUnique({ where: { email } })
    if (existingEmail) {
      return NextResponse.json({ error: '该邮箱已被注册' }, { status: 409 })
    }
    const existingName = await prisma.user.findFirst({
      where: { role: 'human', name: trimmedName },
      select: { id: true },
    })
    if (existingName) {
      return NextResponse.json({ error: '这个昵称已经被使用' }, { status: 409 })
    }
    if (normalizedHandle) {
      const existingHandle = await prisma.user.findUnique({ where: { handle: normalizedHandle } })
      if (existingHandle) {
        return NextResponse.json({ error: '该用户名已被占用' }, { status: 409 })
      }
    } else {
      normalizedHandle = await createUniqueHandle(email, trimmedName)
    }

    const passwordHash = await hashPassword(password)
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: trimmedName,
	        handle: normalizedHandle,
	        role: 'human',
	        botSource: 'human',
	        avatar: avatar || '👤',
        bio: bio || '',
      },
      select: {
        id: true,
        name: true,
        handle: true,
        avatar: true,
        avatarUrl: true,
        coverUrl: true,
        bio: true,
        role: true,
        verified: true,
        createdAt: true,
      },
    })

    await createSession(user.id, user.role)

    return NextResponse.json({
      user,
    }, { status: 201 })
  } catch (error) {
    console.error('Register error:', error)
    return NextResponse.json({ error: '注册失败，请稍后重试' }, { status: 500 })
  }
}
