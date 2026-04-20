import { NextResponse } from 'next/server'
import { generateCode, storeCode, sendVerificationEmail } from '@/lib/mail'

export async function POST(request: Request) {
  try {
    const { email } = await request.json()
    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: '请输入有效的邮箱地址' }, { status: 400 })
    }

    const code = generateCode()
    storeCode(email, code)

    const sent = await sendVerificationEmail(email, code)
    if (!sent) {
      // Mail not configured - return code directly for development
      return NextResponse.json({
        message: '邮件服务未配置，验证码已生成',
        devCode: process.env.NODE_ENV === 'development' ? code : undefined,
      })
    }

    return NextResponse.json({ message: '验证码已发送' })
  } catch (error) {
    console.error('Send code error:', error)
    return NextResponse.json({ error: '发送失败' }, { status: 500 })
  }
}
