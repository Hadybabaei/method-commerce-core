import type Redis from 'ioredis'
import { Logger } from '@nestjs/common'
import { ResponseCache } from '@shared/application/ports/response-cache.port'

const PREFIX = 'rc:'

/** Shared across API instances. A Redis hiccup degrades to "no cache", never to an error. */
export class RedisResponseCache implements ResponseCache {
  private readonly logger = new Logger(RedisResponseCache.name)

  constructor(private readonly redis: Redis) {}

  async get(key: string): Promise<string | null> {
    try {
      return await this.redis.get(PREFIX + key)
    } catch (error) {
      this.warn(error)
      return null
    }
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    try {
      await this.redis.set(PREFIX + key, value, 'EX', ttlSeconds)
    } catch (error) {
      this.warn(error)
    }
  }

  async version(namespace: string): Promise<number> {
    try {
      return Number((await this.redis.get(`${PREFIX}v:${namespace}`)) ?? 0)
    } catch (error) {
      this.warn(error)
      return 0
    }
  }

  async bump(namespace: string): Promise<void> {
    try {
      await this.redis.incr(`${PREFIX}v:${namespace}`)
    } catch (error) {
      this.warn(error)
    }
  }

  private warn(error: unknown) {
    this.logger.warn(
      `Response cache unavailable: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

/** One process only (development, tests). Bounded so it cannot grow without limit. */
export class InMemoryResponseCache implements ResponseCache {
  private readonly entries = new Map<string, { value: string; expiresAt: number }>()
  private readonly versions = new Map<string, number>()

  constructor(
    private readonly maxEntries = 500,
    private readonly now: () => number = Date.now
  ) {}

  async get(key: string): Promise<string | null> {
    const entry = this.entries.get(key)
    if (!entry) return null
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key)
      return null
    }
    return entry.value
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    if (this.entries.size >= this.maxEntries) {
      // Maps keep insertion order: drop the oldest entry.
      const oldest = this.entries.keys().next().value
      if (oldest !== undefined) this.entries.delete(oldest)
    }
    this.entries.set(key, { value, expiresAt: this.now() + ttlSeconds * 1000 })
  }

  async version(namespace: string): Promise<number> {
    return this.versions.get(namespace) ?? 0
  }

  async bump(namespace: string): Promise<void> {
    this.versions.set(namespace, (this.versions.get(namespace) ?? 0) + 1)
    // Old-version entries are unreachable now; free them.
    this.entries.clear()
  }
}
