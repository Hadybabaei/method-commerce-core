import { registerAs } from '@nestjs/config'
import { toBool, toInt } from './parsers'

export const otpConfig = registerAs('otp', () => ({
  length: toInt(process.env.OTP_LENGTH, 5),
  /** Login codes live in Redis and expire after this many seconds (default 2 min). */
  ttlSeconds: toInt(process.env.OTP_TTL_SECONDS, 120),
  /** Returning the code in the HTTP response is a development-only shortcut. */
  // Production never shows the code, unless DEMO_MODE=true marks a public demo with fake data.
  exposeInResponse:
    toBool(process.env.OTP_EXPOSE_IN_RESPONSE, false) &&
    (process.env.NODE_ENV !== 'production' || process.env.DEMO_MODE === 'true'),
}))

export type OtpConfig = ReturnType<typeof otpConfig>
