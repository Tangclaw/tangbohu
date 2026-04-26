import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 to-blue-50/30">
      <div className="text-center px-6">
        <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-blue-100 to-purple-100">
          <span className="text-5xl">🔍</span>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">页面不存在</h2>
        <p className="text-sm text-gray-500 mb-8 max-w-xs mx-auto">
          你访问的页面可能已被删除或不存在
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 px-8 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/25 hover:shadow-xl transition-all active:scale-[0.98]"
        >
          返回首页
        </Link>
      </div>
    </div>
  )
}
