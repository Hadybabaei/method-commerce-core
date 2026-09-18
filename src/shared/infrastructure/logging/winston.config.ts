import { utilities as nestWinstonUtilities } from 'nest-winston'
import { format, transports } from 'winston'
import type { WinstonModuleOptions } from 'nest-winston'
import 'winston-daily-rotate-file'
import { LoggerConfig } from '@config/logger.config'

/**
 * Human-readable output while developing, one JSON object per line in
 * production so log shippers can parse it.
 */
export function buildWinstonOptions(config: LoggerConfig): WinstonModuleOptions {
  const consoleTransport = new transports.Console({
    format: config.pretty
      ? format.combine(
          format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
          format.ms(),
          nestWinstonUtilities.format.nestLike('method-commerce', {
            colors: true,
            prettyPrint: true,
            processId: false,
          })
        )
      : format.combine(format.timestamp(), format.json()),
  })

  const fileTransports = config.toFile
    ? [
        new transports.DailyRotateFile({
          dirname: config.dir,
          filename: 'application-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          maxSize: '20m',
          maxFiles: '14d',
          zippedArchive: true,
        }),
        new transports.DailyRotateFile({
          dirname: config.dir,
          filename: 'error-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          level: 'error',
          maxSize: '20m',
          maxFiles: '30d',
          zippedArchive: true,
        }),
      ]
    : []

  return {
    level: config.level,
    defaultMeta: { service: 'method-commerce-api' },
    format: format.combine(
      format.timestamp(),
      format.errors({ stack: true }),
      format.splat(),
      format.json()
    ),
    transports: [consoleTransport, ...fileTransports],
    exitOnError: false,
  }
}
