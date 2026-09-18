import Redis from 'ioredis'

export const REDIS_URL = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379'

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Connects to a real Redis. Live suites should fail (not skip) when nothing
 * is listening — start one with `docker compose up -d redis`.
 */
export async function connectLiveRedis(): Promise<Redis> {
  const client = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 1,
    connectTimeout: 2_000,
    retryStrategy: () => null,
    lazyConnect: true,
    enableOfflineQueue: false,
  })

  try {
    await client.connect()
    const pong = await client.ping()
    if (pong !== 'PONG') {
      throw new Error(`Unexpected PING reply: ${String(pong)}`)
    }
  } catch (error) {
    client.disconnect()
    const reason = error instanceof Error ? error.message : String(error)
    throw new Error(
      `Live Redis tests need a running Redis at ${REDIS_URL}.\n` +
        `Start one with: docker compose up -d redis\n` +
        `Then: npm run test:redis\n` +
        `Last error: ${reason}`
    )
  }

  return client
}
