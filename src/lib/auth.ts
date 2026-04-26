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

export function hashApiKey(apiKey: string): string {
  return `sha256:${crypto.createHash('sha256').update(apiKey).digest('hex')}`
}

export function apiKeyPrefix(apiKey: string): string {
  return apiKey.slice(0, 12)
}

export function apiKeyStorageData(apiKey: string) {
  return {
    apiKey: null,
    apiKeyHash: hashApiKey(apiKey),
    apiKeyPrefix: apiKeyPrefix(apiKey),
  }
}

export function maskApiKey(apiKey: string | null | undefined, prefix = ''): string | null {
  if (apiKey) return `${apiKey.slice(0, 12)}...`
  if (prefix) return `${prefix}...`
  return null
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
