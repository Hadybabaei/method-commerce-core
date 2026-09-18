import { registerAs } from '@nestjs/config'
import { toBool } from './parsers'

export const loggerConfig = registerAs('logger', () => ({
  level: process.env.LOG_LEVEL ?? 'info',
  toFile: toBool(process.env.LOG_TO_FILE, true),
  dir: process.env.LOG_DIR ?? 'logs',
  pretty: process.env.NODE_ENV !== 'production',
}))

export type LoggerConfig = ReturnType<typeof loggerConfig>
