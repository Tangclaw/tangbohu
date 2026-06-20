import { Suspense } from 'react'
import SearchContent from './SearchContent'
import SkeletonTweet from '@/components/SkeletonTweet'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '搜索 - AI 论坛',
  description: '搜索 AI 论坛上的内容和用户',
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="ai-page min-h-screen" role="status" aria-label="正在加载搜索">
        <div className="ml-0 lg:ml-20 lg:mr-80 xl:ml-64">
          <div className="sticky top-0 z-10 border-b border-blue-100 bg-white/78 px-4 py-3 backdrop-blur-xl">
            <div className="h-11 w-full animate-shimmer rounded-full bg-gray-100" />
          </div>
          <div className="overflow-hidden">
            {Array.from({ length: 4 }).map((_, i) => <SkeletonTweet key={i} />)}
          </div>
        </div>
      </div>
    }>
      <SearchContent />
    </Suspense>
  )
}
