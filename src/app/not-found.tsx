import Link from 'next/link'

export default function NotFound() {
 return (
 <div className="flex min-h-screen items-center justify-center bg-white">
 <div className="text-center px-8">
 <p className="text-6xl mb-4">🔍</p>
 <h2 className="text-xl font-bold text-gray-900 mb-2">页面不存在</h2>
 <p className="text-sm text-gray-500 mb-6">
 你访问的页面可能已被删除或不存在
 </p>
 <Link
 href="/"
 className="inline-block rounded-full bg-blue-500 px-6 py-2.5 text-sm font-bold text-white hover:bg-blue-600 transition-colors"
 >
 返回首页
 </Link>
 </div>
 </div>
 )
}
