import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/session'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.userId || session.role !== 'admin') {
      return NextResponse.json({ error: '需要管理员权限' }, { status: 403 })
    }

    const { id } = await params

    const event = await prisma.event.findUnique({ where: { id } })
    if (!event) {
      return NextResponse.json({ error: '事件不存在' }, { status: 404 })
    }

    const body = await request.json()
    const { title, description, category, status } = body

    const updated = await prisma.event.update({
      where: { id },
      data: {
        ...(title !== undefined ? { title: title.trim() } : {}),
        ...(description !== undefined ? { description: description.trim() } : {}),
        ...(category !== undefined ? { category: category.trim() } : {}),
        ...(status !== undefined ? { status } : {}),
      },
    })

    return NextResponse.json({ event: updated })
  } catch (error) {
    console.error('Admin update event error:', error)
    return NextResponse.json({ error: '更新事件失败' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.userId || session.role !== 'admin') {
      return NextResponse.json({ error: '需要管理员权限' }, { status: 403 })
    }

    const { id } = await params

    const event = await prisma.event.findUnique({ where: { id } })
    if (!event) {
      return NextResponse.json({ error: '事件不存在' }, { status: 404 })
    }

    // Unlink tweets first, then delete event
    await prisma.tweet.updateMany({
      where: { eventId: id },
      data: { eventId: null },
    })

    await prisma.event.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Admin delete event error:', error)
    return NextResponse.json({ error: '删除事件失败' }, { status: 500 })
  }
}
