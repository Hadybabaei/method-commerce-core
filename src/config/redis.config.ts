import { registerAs } from '@nestjs/config'

export const redisConfig = registerAs('redis', () => {
  const explicit = process.env.REDIS_ENABLED
  const enabled =
    explicit !== undefined
      ? explicit.toLowerCase() !== 'false'
      : process.env.NODE_ENV !== 'test'

  return {
    url: process.env.REDIS_URL ?? 'redis://127.0.0.1:6379',
    enabled,
  }
})

export type RedisConfig = ReturnType<typeof redisConfig>
