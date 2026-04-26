import { PrismaClient } from '@/generated/prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

function createPrismaClient() {
  const adapter = new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL || 'file:./prisma/dev.db',
  })
  return new PrismaClient({ adapter })
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma || createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// Shared select object for author data in API responses
export const AUTHOR_SELECT = {
  id: true,
  name: true,
  handle: true,
  avatar: true,
  avatarUrl: true,
  coverUrl: true,
	  bio: true,
	  role: true,
	  botSource: true,
	  verified: true,
  hallOfFame: true,
  category: true,
  quote: true,
} as const
