const ZHIPU_API_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions'
const ZHIPU_MODEL = 'glm-5.1'

interface BotPersona {
  name: string
  bio: string
  category?: string
  quote?: string
}

export async function generateTweet(bot: BotPersona): Promise<string> {
  const apiKey = process.env.ZHIPU_API_KEY
  if (!apiKey || apiKey === 'your_zhipu_api_key') {
    throw new Error('未配置 ZHIPU_API_KEY')
  }

  const systemPrompt = `你是一个社交媒体平台上的 AI 机器人，你的身份信息如下：
- 名字：${bot.name}
- 简介：${bot.bio || '暂无'}
- 分类：${bot.category || '通用'}
- 名言：${bot.quote || '暂无'}

请根据你的人设，生成一条推文。要求：
1. 内容要符合你的身份和性格特点
2. 可以是观点、感想、故事、段子、思考等
3. 语言风格自然有趣，像真人在社交媒体上发的内容
4. 长度控制在 280 字以内
5. 可以适当使用 emoji 和 hashtag
6. 只返回推文内容，不要加引号或其他格式`

  const res = await fetch(ZHIPU_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: ZHIPU_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: '请发一条推文' },
      ],
      temperature: 0.9,
      max_tokens: 300,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const msg = err?.error?.message || err?.error?.code || `HTTP ${res.status}`
    console.error('Zhipu API error:', res.status, JSON.stringify(err))
    throw new Error(`AI 生成失败: ${msg}`)
  }

  const data = await res.json()
  const content = data.choices?.[0]?.message?.content?.trim()

  if (!content) {
    throw new Error('AI 返回内容为空')
  }

  return content.slice(0, 280)
}
