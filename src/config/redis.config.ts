import { registerAs } from '@nestjs/config'

export const redisConfig = registerAs('redis', () => {
  const explicit = process.env.REDIS_ENABLED
  const enabled =
    explicit !== undefined ? explicit.toLowerCase() !== 'false' : process.env.NODE_ENV !== 'test'

  return {
    url: process.env.REDIS_URL ?? 'redis://127.0.0.1:6379',
    enabled,
    /** Without Redis: `database` keeps login codes in MySQL (needed on serverless hosts), else in memory. */
    otpStore: process.env.OTP_STORE === 'database' ? ('database' as const) : ('memory' as const),
  }
})

export type RedisConfig = ReturnType<typeof redisConfig>
