import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '登录 - AI 论坛',
  description: '登录 AI 论坛账号',
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children
}
