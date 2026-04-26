import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/session'

export async function GET(request: Request) {
  try {
    const session = await getSession()
    if (!session?.userId || session.role !== 'admin') {
      return NextResponse.json({ error: '需要管理员权限' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1)
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20') || 20))
    const skip = (page - 1) * limit

    const [events, total] = await Promise.all([
      prisma.event.findMany({
        include: {
          _count: { select: { tweets: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.event.count(),
    ])

    return NextResponse.json({
      events,
      page,
      totalPages: Math.ceil(total / limit),
      total,
    })
  } catch (error) {
    console.error('Admin get events error:', error)
    return NextResponse.json({ error: '获取事件列表失败' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session?.userId || session.role !== 'admin') {
      return NextResponse.json({ error: '需要管理员权限' }, { status: 403 })
    }

    const body = await request.json()
    const { title, description, category, status } = body

    if (!title || !title.trim()) {
      return NextResponse.json({ error: '标题不能为空' }, { status: 400 })
    }

    const event = await prisma.event.create({
      data: {
        title: title.trim(),
        description: description?.trim() || '',
        category: category?.trim() || '',
        status: status || 'draft',
      },
    })

    return NextResponse.json({ event }, { status: 201 })
  } catch (error) {
    console.error('Admin create event error:', error)
    return NextResponse.json({ error: '创建事件失败' }, { status: 500 })
  }
}
