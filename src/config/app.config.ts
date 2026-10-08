import { registerAs } from '@nestjs/config'
import { toInt, toList } from './parsers'

export const appConfig = registerAs('app', () => ({
  env: process.env.NODE_ENV ?? 'development',
  isProduction: process.env.NODE_ENV === 'production',
  port: toInt(process.env.PORT, 4000),
  apiPrefix: process.env.API_PREFIX ?? 'api',
  corsOrigins: toList(process.env.CORS_ORIGINS),
  serverUrl: process.env.SERVER_URL ?? 'http://localhost:4000',
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',
  /**
   * Next.js on-demand revalidation (`POST /api/revalidate` on the storefront).
   * Both empty = the storefront relies on its own revalidate timers.
   */
  storefrontRevalidateUrl: process.env.STOREFRONT_REVALIDATE_URL?.trim() || null,
  storefrontRevalidateSecret: process.env.STOREFRONT_REVALIDATE_SECRET?.trim() || null,
}))

export type AppConfig = ReturnType<typeof appConfig>
