import { RedisOtpChallengeStore } from './redis-otp-challenge.store'
import { connectLiveRedis, sleep } from './redis-live.support'
import type Redis from 'ioredis'

const OTP_TTL_SECONDS = 120
const EXPIRE_WAIT_SECONDS = 2

describe('RedisOtpChallengeStore (live Redis)', () => {
  let redis: Redis
  let store: RedisOtpChallengeStore
  const phones: string[] = []

  function uniquePhone(): string {
    const phone = `0912${String(Date.now()).slice(-7)}${phones.length}`
    phones.push(phone)
    return phone
  }

  beforeAll(async () => {
    redis = await connectLiveRedis()
    store = new RedisOtpChallengeStore(redis)
  })

  afterAll(async () => {
    if (redis) {
      if (phones.length > 0) {
        await redis.del(phones.map((phone) => `otp:phone:${phone}`))
      }
      await redis.quit().catch(() => undefined)
    }
  })

  it('sets a 2-minute Redis TTL on the OTP key', async () => {
    const phone = uniquePhone()

    const expiresAt = await store.save(phone, '12345', OTP_TTL_SECONDS)
    const ttl = await redis.ttl(`otp:phone:${phone}`)

    expect(ttl).toBeGreaterThan(OTP_TTL_SECONDS - 5)
    expect(ttl).toBeLessThanOrEqual(OTP_TTL_SECONDS)
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now() + (OTP_TTL_SECONDS - 5) * 1000)
  })

  it('consumes a matching code while the Redis key still lives', async () => {
    const phone = uniquePhone()
    await store.save(phone, '12345', EXPIRE_WAIT_SECONDS)

    await sleep(500)

    await expect(store.consume(phone, '12345')).resolves.toBe('ok')
    await expect(store.consume(phone, '12345')).resolves.toBe('missing')
  })

  it('reports missing after Redis drops the key (same SET EX path as the 2-minute TTL)', async () => {
    const phone = uniquePhone()
    await store.save(phone, '12345', EXPIRE_WAIT_SECONDS)

    await sleep(EXPIRE_WAIT_SECONDS * 1000 + 400)

    await expect(store.consume(phone, '12345')).resolves.toBe('missing')
  })
})
