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
}))

export type AppConfig = ReturnType<typeof appConfig>
