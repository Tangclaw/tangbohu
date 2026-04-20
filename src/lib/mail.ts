import nodemailer from 'nodemailer'

const serviceMap: Record<string, string> = {
  qq: 'smtp.qq.com',
  gmail: 'smtp.gmail.com',
  163: 'smtp.163.com',
}

function getTransporter() {
  const service = process.env.MAIL_SERVICE || 'qq'
  const user = process.env.MAIL_USER
  const pass = process.env.MAIL_PASS

  if (!user || !pass || user === 'your_email@qq.com') {
    return null
  }

  const host = serviceMap[service] || serviceMap.qq

  return nodemailer.createTransport({
    host,
    port: 465,
    secure: true,
    auth: { user, pass },
  })
}

// In-memory store for verification codes (production should use Redis/DB)
const codeStore = new Map<string, { code: string; expires: number }>()

export function generateCode(): string {
  return Math.random().toString().slice(2, 8)
}

export function storeCode(email: string, code: string) {
  codeStore.set(email, {
    code,
    expires: Date.now() + 5 * 60 * 1000, // 5 minutes
  })
}

export function verifyCode(email: string, inputCode: string): boolean {
  const entry = codeStore.get(email)
  if (!entry) return false
  if (Date.now() > entry.expires) {
    codeStore.delete(email)
    return false
  }
  if (entry.code === inputCode) {
    codeStore.delete(email)
    return true
  }
  return false
}

export async function sendVerificationEmail(email: string, code: string): Promise<boolean> {
  const transporter = getTransporter()
  if (!transporter) {
    console.warn('Mail not configured, skipping email send.')
    return false
  }

  try {
    await transporter.sendMail({
      from: `"AI Twitter" <${process.env.MAIL_USER}>`,
      to: email,
      subject: 'AI Twitter 验证码',
      html: `
        <div style="max-width:400px;margin:0 auto;padding:20px;font-family:sans-serif;">
          <div style="text-align:center;margin-bottom:20px;">
            <h2 style="color:#6366f1;">AI Twitter</h2>
          </div>
          <div style="background:#f9fafb;border-radius:12px;padding:20px;text-align:center;">
            <p style="color:#374151;margin-bottom:12px;">你的验证码是</p>
            <p style="font-size:32px;font-weight:bold;color:#6366f1;letter-spacing:4px;margin:0;">${code}</p>
            <p style="color:#9ca3af;font-size:12px;margin-top:12px;">5 分钟内有效</p>
          </div>
          <p style="color:#9ca3af;font-size:12px;text-align:center;margin-top:16px;">
            如果这不是你的操作，请忽略此邮件
          </p>
        </div>
      `,
    })
    return true
  } catch (error) {
    console.error('Send email error:', error)
    return false
  }
}
