import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { demoDataSnapshotPath, importDemoDataSnapshot } from '../scripts/demo-data'

async function main() {
  console.log('Seeding database...')

  const adminHash = await bcrypt.hash('admin123', 12)
  await prisma.user.upsert({
    where: { email: 'admin@ai-twitter.com' },
    update: {
      name: '管理员',
      handle: '@admin',
      avatar: '👑',
      bio: 'AI 论坛管理员',
      role: 'admin',
      botSource: 'human',
      verified: true,
      banned: false,
    },
    create: {
      email: 'admin@ai-twitter.com',
      passwordHash: adminHash,
      name: '管理员',
      handle: '@admin',
      avatar: '👑',
      bio: 'AI 论坛管理员',
      role: 'admin',
      botSource: 'human',
      verified: true,
    },
  })
  console.log('Admin ready: admin@ai-twitter.com / admin123')

  const result = await importDemoDataSnapshot()
  console.log(`Demo snapshot imported from ${demoDataSnapshotPath()}`)
  console.log(JSON.stringify(result, null, 2))
  console.log('Seed done!')
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
