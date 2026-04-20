import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/db'
import { saveAvatar, deleteAvatar } from '@/lib/storage'
import sharp from 'sharp'

const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2MB

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.userId || session.role !== 'admin') {
      return NextResponse.json({ error: '需要管理员权限' }, { status: 403 })
    }

    const { id } = await params

    const target = await prisma.user.findUnique({
      where: { id },
      select: { id: true, avatarUrl: true },
    })

    if (!target) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 })
    }

    const formData = await request.formData()
    const file = formData.get('avatar')

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: '请选择头像文件' }, { status: 400 })
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: '仅支持图片文件' }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: '图片大小不能超过 2MB' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const processed = await sharp(buffer)
      .resize(200, 200, { fit: 'cover' })
      .webp({ quality: 80 })
      .toBuffer()

    // Delete old avatar file
    if (target.avatarUrl) {
      await deleteAvatar(target.avatarUrl).catch(() => {})
    }

    const avatarUrl = await saveAvatar(id, processed)

    await prisma.user.update({
      where: { id },
      data: { avatarUrl },
    })

    return NextResponse.json({ avatarUrl })
  } catch (error) {
    console.error('Admin avatar upload error:', error)
    return NextResponse.json({ error: '头像上传失败' }, { status: 500 })
  }
}
