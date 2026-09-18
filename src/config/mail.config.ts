import { registerAs } from '@nestjs/config'
import { toBool, toInt } from './parsers'

export const mailConfig = registerAs('mail', () => ({
  host: process.env.MAIL_HOST ?? '',
  port: toInt(process.env.MAIL_PORT, 465),
  secure: toBool(process.env.MAIL_SECURE, true),
  user: process.env.MAIL_USER ?? '',
  password: process.env.MAIL_PASSWORD ?? '',
  from: process.env.MAIL_FROM ?? 'method-commerce <no-reply@localhost>',
  passwordResetTtlSeconds: toInt(process.env.PASSWORD_RESET_TTL_SECONDS, 600),
}))

export type MailConfig = ReturnType<typeof mailConfig>
