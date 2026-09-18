import { InMemoryOtpChallengeStore } from './in-memory-otp-challenge.store'

describe('InMemoryOtpChallengeStore TTL (Redis 2-minute default)', () => {
  const phone = '09121234567'
  const ttlSeconds = 120

  function storeWithClock(startMs = Date.parse('2026-09-17T10:00:00.000Z')) {
    let nowMs = startMs
    const store = new InMemoryOtpChallengeStore(() => nowMs)
    return {
      store,
      issuedAt: startMs,
      advanceSeconds(seconds: number) {
        nowMs += seconds * 1000
      },
    }
  }

  it('records expiry exactly 2 minutes after issue', async () => {
    const { store, issuedAt } = storeWithClock()

    const expiresAt = await store.save(phone, '12345', ttlSeconds)

    expect(expiresAt.getTime()).toBe(issuedAt + ttlSeconds * 1000)
  })

  it('consumes a matching code 1 second before the 2-minute TTL', async () => {
    const { store, advanceSeconds } = storeWithClock()
    await store.save(phone, '12345', ttlSeconds)

    advanceSeconds(119)

    await expect(store.consume(phone, '12345')).resolves.toBe('ok')
  })

  it('treats the code as missing once the 2-minute TTL elapses', async () => {
    const { store, advanceSeconds } = storeWithClock()
    await store.save(phone, '12345', ttlSeconds)

    advanceSeconds(120)

    await expect(store.consume(phone, '12345')).resolves.toBe('missing')
  })
})
