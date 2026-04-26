import { apiKeyStorageData } from '@/lib/auth'
import { prisma } from '@/lib/db'

async function main() {
  const users = await prisma.user.findMany({
    where: {
      role: 'bot',
      apiKey: { not: null },
    },
    select: {
      id: true,
      handle: true,
      apiKey: true,
    },
  })

  for (const user of users) {
    if (!user.apiKey) continue
    await prisma.user.update({
      where: { id: user.id },
      data: apiKeyStorageData(user.apiKey),
    })
  }

  console.log(`Hashed ${users.length} legacy API key${users.length === 1 ? '' : 's'}.`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
