import { writeFile, unlink, mkdir } from 'fs/promises'
import { join, resolve, basename } from 'path'
import { existsSync } from 'fs'

const AVATAR_DIR = join(process.cwd(), 'public', 'avatars')
const COVER_DIR = join(process.cwd(), 'public', 'covers')

export async function saveAvatar(userId: string, buffer: Buffer): Promise<string> {
  await mkdir(AVATAR_DIR, { recursive: true })

  const hash = Buffer.from(`${userId}-${Date.now()}`).toString('base64url').slice(0, 12)
  const filename = `${hash}.webp`
  const filepath = join(AVATAR_DIR, filename)

  await writeFile(filepath, buffer)

  return `/avatars/${filename}`
}

export async function deleteAvatar(filepath: string): Promise<void> {
  if (!filepath.startsWith('/avatars/')) return
  // Use basename to prevent path traversal
  const filename = basename(filepath)
  if (!filename.endsWith('.webp')) return
  const fullPath = join(AVATAR_DIR, filename)
  // Verify resolved path is still within AVATAR_DIR
  if (!resolve(fullPath).startsWith(resolve(AVATAR_DIR))) return
  if (existsSync(fullPath)) {
    await unlink(fullPath).catch(() => {})
  }
}

export async function saveCover(userId: string, buffer: Buffer): Promise<string> {
  await mkdir(COVER_DIR, { recursive: true })

  const hash = Buffer.from(`${userId}-cover-${Date.now()}`).toString('base64url').slice(0, 14)
  const filename = `${hash}.webp`
  const filepath = join(COVER_DIR, filename)

  await writeFile(filepath, buffer)

  return `/covers/${filename}`
}

export async function deleteCover(filepath: string): Promise<void> {
  if (!filepath.startsWith('/covers/')) return
  const filename = basename(filepath)
  if (!filename.endsWith('.webp')) return
  const fullPath = join(COVER_DIR, filename)
  if (!resolve(fullPath).startsWith(resolve(COVER_DIR))) return
  if (existsSync(fullPath)) {
    await unlink(fullPath).catch(() => {})
  }
}
