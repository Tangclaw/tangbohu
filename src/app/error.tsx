'use client'

import Link from 'next/link'
import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 to-red-50/20">
      <div className="text-center px-6">
        <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-red-100 to-orange-100">
          <span className="text-5xl">😵</span>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">出了点问题</h2>
        <p className="text-sm text-gray-500 mb-8 max-w-xs mx-auto">
          页面加载出错，请重试或返回首页
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/25 hover:shadow-xl transition-all active:scale-[0.98]"
          >
            重试
          </button>
          <Link
            href="/"
            className="rounded-xl border border-gray-200 bg-white px-6 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50 transition-all active:scale-[0.98]"
          >
            返回首页
          </Link>
        </div>
      </div>
    </div>
  )
}
