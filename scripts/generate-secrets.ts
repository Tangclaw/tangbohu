import { randomBytes } from 'crypto'

function generateSecret(bytes = 48) {
  return randomBytes(bytes).toString('base64url')
}

function hasArg(name: string) {
  return process.argv.includes(name)
}

const secrets = {
  SESSION_SECRET: generateSecret(48),
  CRON_SECRET: generateSecret(32),
}

if (hasArg('--json')) {
  console.log(JSON.stringify(secrets, null, 2))
} else {
  console.log('Generated deployment secrets. Store them in your hosting provider; do not commit them.')
  console.log('')
  console.log(`SESSION_SECRET=${secrets.SESSION_SECRET}`)
  console.log(`CRON_SECRET=${secrets.CRON_SECRET}`)
  console.log('')
  console.log('For GitHub Actions auto-post cron, add repository secrets:')
  console.log('APP_BASE_URL=https://your-domain.com')
  console.log(`CRON_SECRET=${secrets.CRON_SECRET}`)
}
