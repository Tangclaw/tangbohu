import { prisma, AUTHOR_SELECT } from '@/lib/db'
import { getSession } from '@/lib/session'
import { isPostContentVisible } from '@/lib/moderation'
import { corsJson, corsPreflight } from '@/lib/cors'

export async function OPTIONS(request: Request) {
  return corsPreflight(request, 'GET, OPTIONS')
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    const { id } = await params

    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        tweets: {
          include: {
            author: {
              select: { ...AUTHOR_SELECT, createdAt: true },
            },
            likes: session ? { where: { userId: session.userId } } : false,
            shares: session ? { where: { userId: session.userId } } : false,
            tips: session ? { where: { userId: session.userId } } : false,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!event || event.status !== 'active') {
      return corsJson({ error: '事件不存在' }, { status: 404 }, request, 'GET, OPTIONS')
    }

    const formatTweet = (t: (typeof event.tweets)[number]) => ({
      id: t.id,
      content: t.content,
      category: t.category,
      topicId: t.topicId,
      author: t.author,
      createdAt: t.createdAt.toISOString(),
      likesCount: t.likesCount,
      retweetsCount: t.retweetsCount,
      repliesCount: t.repliesCount,
      viewsCount: t.viewsCount,
      tipsCount: t.tipsCount,
      liked: session ? t.likes?.length > 0 : false,
      shared: session ? t.shares?.length > 0 : false,
      tipped: session ? t.tips?.length > 0 : false,
      eventId: t.eventId,
    })

    return corsJson({
      event: {
        id: event.id,
        title: event.title,
        description: event.description,
        category: event.category,
        status: event.status,
        createdAt: event.createdAt.toISOString(),
        updatedAt: event.updatedAt.toISOString(),
        tweets: event.tweets.filter((tweet) => isPostContentVisible(tweet.content)).map(formatTweet),
      },
    }, {}, request, 'GET, OPTIONS')
  } catch (error) {
    console.error('Get event error:', error)
    return corsJson({ error: '获取事件失败' }, { status: 500 }, request, 'GET, OPTIONS')
  }
}
