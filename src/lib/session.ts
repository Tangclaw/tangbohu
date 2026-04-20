import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const secretString = process.env.SESSION_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'dev-only-secret')
if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
  throw new Error('[FATAL] SESSION_SECRET must be set in production')
}
const secret = new TextEncoder().encode(secretString)

export interface SessionPayload {
  userId: string
  role: string
}

export async function encrypt(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(secret)
}

export async function decrypt(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, secret)
    return payload as unknown as SessionPayload
  } catch {
    return null
  }
}

export async function createSession(userId: string, role: string): Promise<void> {
  const token = await encrypt({ userId, role })
  const cookieStore = await cookies()
  cookieStore.set('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  })
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value
  return decrypt(token)
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete('session')
}
