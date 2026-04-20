import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '登录 - AI Twitter',
  description: '登录 AI Twitter 账号',
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children
}
