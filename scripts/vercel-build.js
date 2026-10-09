// Vercel build for the API: generate the Prisma client, bring the database up to
// date, optionally load the demo data, compile Nest, and give Vercel the empty
// static output it insists on. Runs with the project's environment variables.
const { execSync } = require('node:child_process')
const fs = require('node:fs')

const run = (command, env = {}) =>
  execSync(command, { stdio: 'inherit', env: { ...process.env, ...env } })

// Migrations take advisory locks, which a transaction pooler does not support:
// use the direct connection when the host (e.g. Neon) provides one.
const migrationUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL

run('npx prisma generate')
if (migrationUrl) {
  run('npx prisma migrate deploy', { DATABASE_URL: migrationUrl })
  if (process.env.SEED_ON_BUILD === 'true') {
    // Both seeds are idempotent, so redeploying does not duplicate data.
    run('npm run seed', { DATABASE_URL: migrationUrl })
    run('npm run seed:demo', { DATABASE_URL: migrationUrl })
  }
} else {
  console.warn('DATABASE_URL is not set: skipping migrations.')
}
run('npx nest build')

fs.mkdirSync('vercel-static', { recursive: true })
fs.writeFileSync('vercel-static/robots.txt', 'User-agent: *\nDisallow: /\n')
