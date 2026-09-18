import { registerAs } from '@nestjs/config'
import { toBool, toInt } from './parsers'

export const otpConfig = registerAs('otp', () => ({
  length: toInt(process.env.OTP_LENGTH, 5),
  /** Login codes live in Redis and expire after this many seconds (default 2 min). */
  ttlSeconds: toInt(process.env.OTP_TTL_SECONDS, 120),
  /** Returning the code in the HTTP response is a development-only shortcut. */
  exposeInResponse:
    toBool(process.env.OTP_EXPOSE_IN_RESPONSE, false) && process.env.NODE_ENV !== 'production',
}))

export type OtpConfig = ReturnType<typeof otpConfig>
