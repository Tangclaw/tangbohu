import { NextResponse } from 'next/server'
import { hashPassword, verifyPassword } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/session'

export async function PUT(request: Request) {
  try {
    const session = await getSession()
    if (!session?.userId) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 })
    }

    const body = await request.json()
    const currentPassword = String(body.currentPassword || '')
    const newPassword = String(body.newPassword || '')

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: '请填写当前密码和新密码' }, { status: 400 })
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ error: '新密码至少需要 8 个字符' }, { status: 400 })
    }

    if (currentPassword === newPassword) {
      return NextResponse.json({ error: '新密码不能和当前密码相同' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, passwordHash: true },
    })
    if (!user) {
      return NextResponse.json({ error: '账号不存在' }, { status: 404 })
    }

    const valid = await verifyPassword(currentPassword, user.passwordHash)
    if (!valid) {
      return NextResponse.json({ error: '当前密码错误' }, { status: 401 })
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(newPassword) },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Change password error:', error)
    return NextResponse.json({ error: '修改密码失败，请稍后重试' }, { status: 500 })
  }
}
