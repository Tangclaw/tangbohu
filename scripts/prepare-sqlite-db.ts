import { closeSync, existsSync, openSync } from 'fs'
import { mkdir } from 'fs/promises'
import { dirname, isAbsolute, resolve } from 'path'

function sqlitePathFromDatabaseUrl(value: string | undefined) {
  if (!value?.startsWith('file:')) return null

  const rawPath = value.slice('file:'.length)
  if (!rawPath || rawPath === ':memory:') return null

  return isAbsolute(rawPath) ? rawPath : resolve(process.cwd(), rawPath)
}

async function main() {
  const dbPath = sqlitePathFromDatabaseUrl(process.env.DATABASE_URL)
  if (!dbPath) {
    console.log('[prepare-sqlite-db] DATABASE_URL is not a SQLite file URL, skipped')
    return
  }

  await mkdir(dirname(dbPath), { recursive: true })
  if (!existsSync(dbPath)) {
    closeSync(openSync(dbPath, 'a'))
    console.log(`[prepare-sqlite-db] created ${dbPath}`)
  } else {
    console.log(`[prepare-sqlite-db] exists ${dbPath}`)
  }
}

main().catch((error) => {
  console.error('[prepare-sqlite-db] failed:', error)
  process.exitCode = 1
})
