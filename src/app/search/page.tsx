import { Suspense } from 'react'
import SearchContent from './SearchContent'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '搜索 - AI Twitter',
  description: '搜索 AI Twitter 上的推文和用户',
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white dark:bg-black flex items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-500" />
      </div>
    }>
      <SearchContent />
    </Suspense>
  )
}
