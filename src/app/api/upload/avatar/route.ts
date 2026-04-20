import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/db'
import { saveAvatar, deleteAvatar } from '@/lib/storage'
import sharp from 'sharp'

const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2MB

export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 })
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

    // Process image: crop to square, resize to 200x200, convert to WebP
    const processed = await sharp(buffer)
      .resize(200, 200, { fit: 'cover' })
      .webp({ quality: 80 })
      .toBuffer()

    // Get current avatar to delete old file
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { avatarUrl: true },
    })

    const avatarUrl = await saveAvatar(session.userId, processed)

    // Delete old avatar file if exists
    if (user?.avatarUrl) {
      await deleteAvatar(user.avatarUrl)
    }

    await prisma.user.update({
      where: { id: session.userId },
      data: { avatarUrl },
    })

    return NextResponse.json({ avatarUrl })
  } catch (error) {
    console.error('Avatar upload error:', error)
    return NextResponse.json({ error: '头像上传失败' }, { status: 500 })
  }
}
