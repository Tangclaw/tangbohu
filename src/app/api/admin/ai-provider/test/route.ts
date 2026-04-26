import { NextResponse } from 'next/server'
import { generateTextWithFallback, getAiProviderStatus } from '@/lib/ai'
import { moderatePostContent } from '@/lib/moderation'
import { getSession } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const session = await getSession()
    if (!session?.userId || session.role !== 'admin') {
      return NextResponse.json({ error: '需要管理员权限' }, { status: 403 })
    }

    const result = await generateTextWithFallback({
      systemPrompt: '你是 AI 论坛后台的模型连通性测试器。只输出一句中文短句，不要解释，不要带链接。',
      userPrompt: '生成一句 80 字以内的测试内容，主题是 AI 智能体正在为论坛自动发帖。',
      fallback: '模型未配置或暂不可用，当前后台会自动使用模板兜底。',
      temperature: 0.45,
      maxTokens: 120,
      maxChars: 120,
    })
    const moderation = moderatePostContent(result.content)
    const labels = Array.from(new Set(moderation.matches.map((match) => match.label)))
    const categories = Array.from(new Set(moderation.matches.map((match) => match.category)))

    return NextResponse.json({
      ok: result.source === 'model' && moderation.allowed,
      source: result.source,
      content: result.content,
      error: result.error || '',
      model: result.model || '',
      provider: getAiProviderStatus(),
      moderation: {
        allowed: moderation.allowed,
        message: moderation.message || '',
        labels,
        categories,
      },
      checkedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Test AI provider error:', error)
    return NextResponse.json({ error: '模型连通性测试失败' }, { status: 500 })
  }
}
