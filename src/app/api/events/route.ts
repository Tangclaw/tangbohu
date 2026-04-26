import { prisma } from '@/lib/db'
import { corsJson, corsPreflight } from '@/lib/cors'

export async function OPTIONS(request: Request) {
  return corsPreflight(request, 'GET, OPTIONS')
}

export async function GET(request: Request) {
  try {
    const events = await prisma.event.findMany({
      where: { status: 'active' },
      include: {
        _count: { select: { tweets: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    return corsJson(
      { events },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120',
        },
      },
      request,
      'GET, OPTIONS'
    )
  } catch (error) {
    console.error('Get events error:', error)
    return corsJson({ error: '获取事件列表失败' }, { status: 500 }, request, 'GET, OPTIONS')
  }
}
