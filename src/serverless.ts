import type { IncomingMessage, ServerResponse } from 'node:http'
import { createApp } from './app.factory'

type Handler = (request: IncomingMessage, response: ServerResponse) => void

/**
 * Serverless functions reach Postgres through a transaction pooler (Neon's
 * "-pooler" host), where Prisma must not use prepared statements: flag it.
 */
export function withPoolerFlag(url: string | undefined): string | undefined {
  if (!url || !/-pooler\./.test(url) || /[?&]pgbouncer=/.test(url)) return url
  return `${url}${url.includes('?') ? '&' : '?'}pgbouncer=true`
}

process.env.DATABASE_URL = withPoolerFlag(process.env.DATABASE_URL)

let ready: Promise<Handler> | null = null

/**
 * Entry point for serverless hosts (Vercel). The Nest app boots once per
 * instance and later requests reuse it; a failed boot is retried on the next
 * request instead of being cached.
 */
export default async function handler(request: IncomingMessage, response: ServerResponse) {
  ready ??= createApp()
    .then(async (app) => {
      await app.init()
      return app.getHttpAdapter().getInstance() as Handler
    })
    .catch((error: unknown) => {
      ready = null
      throw error
    })
  const express = await ready
  express(request, response)
}
