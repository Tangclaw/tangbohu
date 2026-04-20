import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { decrypt } from '@/lib/session'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Protect admin page routes
  if (pathname.startsWith('/admin')) {
    const cookie = request.cookies.get('session')?.value
    const session = await decrypt(cookie)

    if (!session?.userId || session.role !== 'admin') {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  // Protect admin API routes
  if (pathname.startsWith('/api/admin')) {
    const cookie = request.cookies.get('session')?.value
    const session = await decrypt(cookie)

    if (!session?.userId || session.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
}
