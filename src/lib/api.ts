import { NextResponse } from 'next/server'

type ApiError = {
  error: string
  status: number
}

const API_ERRORS: Record<string, ApiError> = {
  unauthorized: { error: '请先登录', status: 401 },
  forbidden: { error: '无权限', status: 403 },
  not_found: { error: '资源不存在', status: 404 },
  bad_request: { error: '请求参数错误', status: 400 },
  rate_limited: { error: '操作过于频繁，请稍后再试', status: 429 },
  server_error: { error: '服务器错误', status: 500 },
}

export function apiError(key: keyof typeof API_ERRORS, overrideMsg?: string) {
  const err = API_ERRORS[key]
  return NextResponse.json(
    { error: overrideMsg || err.error },
    { status: err.status }
  )
}

export function apiSuccess(data: Record<string, unknown>, status = 200) {
  return NextResponse.json(data, { status })
}
