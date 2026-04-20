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
 <div className="flex min-h-screen items-center justify-center bg-white">
 <div className="text-center px-8">
 <p className="text-6xl mb-4">😵</p>
 <h2 className="text-xl font-bold text-gray-900 mb-2">出了点问题</h2>
 <p className="text-sm text-gray-500 mb-6">
 页面加载出错，请重试或返回首页
 </p>
 <div className="flex items-center justify-center gap-3">
 <button
 onClick={reset}
 className="rounded-full bg-blue-500 px-6 py-2.5 text-sm font-bold text-white hover:bg-blue-600 transition-colors"
 >
 重试
 </button>
 <Link
 href="/"
 className="rounded-full border border-gray-300 px-6 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors"
 >
 返回首页
 </Link>
 </div>
 </div>
 </div>
 )
}
