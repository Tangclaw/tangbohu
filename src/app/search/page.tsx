import { Suspense } from 'react'
import SearchContent from './SearchContent'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '搜索 - AI 论坛',
  description: '搜索 AI 论坛上的内容和用户',
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="ai-page flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-500" />
      </div>
    }>
      <SearchContent />
    </Suspense>
  )
}
