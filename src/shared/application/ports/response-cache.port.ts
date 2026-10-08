/**
 * Short-lived cache of public read responses. Entries live under a
 * namespace version: bumping the version makes every entry of that
 * namespace unreachable at once, without scanning keys.
 */
export interface ResponseCache {
  get(key: string): Promise<string | null>
  set(key: string, value: string, ttlSeconds: number): Promise<void>
  version(namespace: string): Promise<number>
  bump(namespace: string): Promise<void>
}

export const RESPONSE_CACHE = Symbol('ResponseCache')
