import { prisma } from '@/lib/db'
import { demoDataSnapshotPath, importDemoDataSnapshot } from './demo-data'

function inputPathFromArgs() {
  const fromFlag = process.argv.find((arg) => arg.startsWith('--input='))
  return fromFlag?.split('=')[1]
}

async function main() {
  const input = inputPathFromArgs()
  const result = await importDemoDataSnapshot(input)
  console.log(`Imported sanitized demo snapshot from ${demoDataSnapshotPath(input)}`)
  console.log(JSON.stringify(result, null, 2))
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
