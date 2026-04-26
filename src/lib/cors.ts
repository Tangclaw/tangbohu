import { NextResponse } from 'next/server'

const DEFAULT_ALLOWED_METHODS = 'GET, POST, PUT, OPTIONS'
const DEFAULT_ALLOWED_HEADERS = 'Content-Type, Authorization, x-api-key'

function allowedOrigins() {
  const configured = process.env.BOT_API_ALLOWED_ORIGINS || '*'
  return configured
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
}

function resolveOrigin(request?: Request) {
  const origins = allowedOrigins()
  if (origins.includes('*')) return '*'

  const origin = request?.headers.get('origin')
  if (!origin) return origins[0] || '*'
  return origins.includes(origin) ? origin : null
}

function mergeHeaders(base: HeadersInit | undefined, extra: Record<string, string>) {
  const headers = new Headers(base)
  for (const [key, value] of Object.entries(extra)) {
    headers.set(key, value)
  }
  return headers
}

export function corsHeaders(request?: Request, methods = DEFAULT_ALLOWED_METHODS) {
  const origin = resolveOrigin(request)
  if (!origin) return {}

  const headers: Record<string, string> = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': methods,
    'Access-Control-Allow-Headers': DEFAULT_ALLOWED_HEADERS,
    'Access-Control-Expose-Headers': 'Retry-After, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset',
    'Access-Control-Max-Age': '86400',
  }

  if (origin !== '*') headers.Vary = 'Origin'
  return headers
}

export function corsJson(
  data: Record<string, unknown>,
  init: ResponseInit = {},
  request?: Request,
  methods?: string
) {
  return NextResponse.json(data, {
    ...init,
    headers: mergeHeaders(init.headers, corsHeaders(request, methods)),
  })
}

export function corsPreflight(request?: Request, methods?: string) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(request, methods),
  })
}
