import { Inject, Injectable } from '@nestjs/common'
import Redis from 'ioredis'
import {
  OtpChallengeStore,
  OtpConsumeResult,
} from '@shared/application/ports/otp-challenge-store.port'
import { REDIS_CLIENT } from './redis.tokens'

const KEY_PREFIX = 'otp:phone:'

/**
 * Stores login OTPs in Redis. The key TTL is the sole expiry mechanism —
 * once Redis drops the key, verification reports "not requested / expired".
 */
@Injectable()
export class RedisOtpChallengeStore implements OtpChallengeStore {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async save(phoneNumber: string, code: string, ttlSeconds: number): Promise<Date> {
    const key = KEY_PREFIX + phoneNumber
    await this.redis.set(key, code, 'EX', ttlSeconds)
    return new Date(Date.now() + ttlSeconds * 1000)
  }

  async consume(phoneNumber: string, code: string): Promise<OtpConsumeResult> {
    const key = KEY_PREFIX + phoneNumber
    const stored = await this.redis.get(key)

    if (stored === null) {
      return 'missing'
    }

    if (stored !== String(code ?? '').trim()) {
      return 'mismatch'
    }

    await this.redis.del(key)
    return 'ok'
  }
}
