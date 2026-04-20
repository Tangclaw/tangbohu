import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { hashPassword, generateApiKey } from '@/lib/auth'
import { createSession } from '@/lib/session'
import { verifyCode } from '@/lib/mail'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, password, name, handle, role = 'human', avatar, bio, code: emailCode } = body

    // Validate
    if (!email || !password || !name || !handle) {
      return NextResponse.json({ error: '请填写所有必填字段' }, { status: 400 })
    }
    if (password.length < 6) {
      return NextResponse.json({ error: '密码至少需要6个字符' }, { status: 400 })
    }
    if (!['human', 'bot'].includes(role)) {
      return NextResponse.json({ error: '角色只能是 human 或 bot' }, { status: 400 })
    }
    // Validate handle format
    const cleanHandle = handle.replace(/^@/, '')
    if (cleanHandle.length < 2) {
      return NextResponse.json({ error: '用户名至少需要2个字符' }, { status: 400 })
    }
    if (!/^[a-zA-Z0-9_\u4e00-\u9fff]+$/.test(cleanHandle)) {
      return NextResponse.json({ error: '用户名只能包含字母、数字、下划线或中文' }, { status: 400 })
    }
    // Normalize handle to @username format
    const normalizedHandle = `@${cleanHandle}`

    // Verify email code
    if (!verifyCode(email, emailCode)) {
      return NextResponse.json({ error: '验证码错误或已过期' }, { status: 400 })
    }

    // Check uniqueness
    const existingEmail = await prisma.user.findUnique({ where: { email } })
    if (existingEmail) {
      return NextResponse.json({ error: '该邮箱已被注册' }, { status: 409 })
    }
    const existingHandle = await prisma.user.findUnique({ where: { handle: normalizedHandle } })
    if (existingHandle) {
      return NextResponse.json({ error: '该用户名已被占用' }, { status: 409 })
    }

    const passwordHash = await hashPassword(password)
    const apiKey = role === 'bot' ? generateApiKey() : null

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        handle: normalizedHandle,
        role,
        avatar: avatar || (role === 'bot' ? '🤖' : '👤'),
        bio: bio || '',
        apiKey,
      },
      select: {
        id: true,
        name: true,
        handle: true,
        avatar: true,
        avatarUrl: true,
        bio: true,
        role: true,
        verified: true,
        createdAt: true,
      },
    })

    await createSession(user.id, user.role)

    return NextResponse.json({
      user,
      ...(apiKey ? { apiKey } : {}),
    }, { status: 201 })
  } catch (error) {
    console.error('Register error:', error)
    return NextResponse.json({ error: '注册失败，请稍后重试' }, { status: 500 })
  }
}
