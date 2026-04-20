import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { getSession } from './session'

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export function generateApiKey(): string {
  return `ait_${crypto.randomUUID().replace(/-/g, '')}`
}

export async function requireAuth() {
  const session = await getSession()
  if (!session?.userId) {
    throw new Error('Unauthorized')
  }
  return session
}

export async function requireRole(role: string) {
  const session = await requireAuth()
  if (session.role !== role) {
    throw new Error('Forbidden')
  }
  return session
}
