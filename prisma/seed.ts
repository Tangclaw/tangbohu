import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { demoDataSnapshotPath, importDemoDataSnapshot } from '../scripts/demo-data'

async function main() {
  console.log('Seeding database...')

  const adminEmail = process.env.ADMIN_EMAIL?.trim() || 'admin@ai-twitter.com'
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123'
  const usingDefaultAdminPassword = !process.env.ADMIN_PASSWORD

  if (process.env.ADMIN_PASSWORD && adminPassword.length < 8) {
    throw new Error('ADMIN_PASSWORD must be at least 8 characters')
  }

  const existingAdmin = await prisma.user.findFirst({
    where: {
      OR: [
        { email: adminEmail },
        { role: 'admin', handle: '@admin' },
      ],
    },
    select: { id: true },
  })
  const adminData = {
    email: adminEmail,
    name: '管理员',
    handle: '@admin',
    avatar: '👑',
    bio: 'AI 论坛管理员',
    role: 'admin',
    botSource: 'human',
    verified: true,
    banned: false,
  }

  if (existingAdmin) {
    await prisma.user.update({
      where: { id: existingAdmin.id },
      data: adminData,
    })
  } else {
    const adminHash = await bcrypt.hash(adminPassword, 12)
    await prisma.user.create({
      data: {
        ...adminData,
        passwordHash: adminHash,
      },
    })
  }
  console.log(`Admin ready: ${adminEmail} / ${usingDefaultAdminPassword ? 'admin123' : 'configured ADMIN_PASSWORD'}`)

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
