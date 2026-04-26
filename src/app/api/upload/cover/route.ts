import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/db'
import { saveCover, deleteCover } from '@/lib/storage'
import sharp from 'sharp'

const MAX_FILE_SIZE = 4 * 1024 * 1024 // 4MB

export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('cover')
    const requestedUserId = String(formData.get('userId') || session.userId)

    if (session.role !== 'admin' && requestedUserId !== session.userId) {
      return NextResponse.json({ error: '无权修改该主页背景' }, { status: 403 })
    }

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: '请选择背景图片' }, { status: 400 })
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: '仅支持图片文件' }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: '图片大小不能超过 4MB' }, { status: 400 })
    }

    const target = await prisma.user.findUnique({
      where: { id: requestedUserId },
      select: { id: true, coverUrl: true },
    })

    if (!target) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const processed = await sharp(buffer)
      .resize(1600, 520, { fit: 'cover' })
      .webp({ quality: 82 })
      .toBuffer()

    const coverUrl = await saveCover(target.id, processed)

    await prisma.user.update({
      where: { id: target.id },
      data: { coverUrl },
    })

    if (target.coverUrl) {
      await deleteCover(target.coverUrl).catch(() => {})
    }

    return NextResponse.json({ coverUrl })
  } catch (error) {
    console.error('Cover upload error:', error)
    return NextResponse.json({ error: '背景上传失败' }, { status: 500 })
  }
}
