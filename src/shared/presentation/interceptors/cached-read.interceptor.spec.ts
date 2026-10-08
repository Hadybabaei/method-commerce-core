import { CallHandler, ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { firstValueFrom, of } from 'rxjs'
import { InMemoryResponseCache } from '@shared/infrastructure/cache/response-caches'
import { CachedReadInterceptor } from './cached-read.interceptor'

function context(request: { method?: string; url: string; headers?: Record<string, string> }) {
  const headers: Record<string, string> = {}
  const http = {
    getRequest: () => ({ method: 'GET', headers: {}, ...request }),
    getResponse: () => ({ setHeader: (name: string, value: string) => (headers[name] = value) }),
  }
  return {
    headers,
    ctx: {
      switchToHttp: () => http,
      getHandler: () => () => undefined,
    } as unknown as ExecutionContext,
  }
}

describe('CachedReadInterceptor', () => {
  function setup() {
    const cache = new InMemoryResponseCache()
    const reflector = {
      get: () => ({ namespace: 'catalog', ttlSeconds: 60 }),
    } as unknown as Reflector
    let calls = 0
    const handler: CallHandler = { handle: () => of({ n: ++calls }) }
    return {
      cache,
      interceptor: new CachedReadInterceptor(cache, reflector),
      handler,
      calls: () => calls,
    }
  }

  const run = async (
    interceptor: CachedReadInterceptor,
    handler: CallHandler,
    request: Parameters<typeof context>[0]
  ) => {
    const { ctx, headers } = context(request)
    const body = await firstValueFrom(interceptor.intercept(ctx, handler))
    return { body, headers }
  }

  it('serves the second anonymous read from cache, per URL', async () => {
    const { interceptor, handler, calls } = setup()
    expect(await run(interceptor, handler, { url: '/api/products?a=1' })).toEqual({
      body: { n: 1 },
      headers: { 'X-Cache': 'MISS' },
    })
    await new Promise((resolve) => setImmediate(resolve))
    expect(await run(interceptor, handler, { url: '/api/products?a=1' })).toEqual({
      body: { n: 1 },
      headers: { 'X-Cache': 'HIT' },
    })
    expect((await run(interceptor, handler, { url: '/api/products?a=2' })).body).toEqual({ n: 2 })
    expect(calls()).toBe(2)
  })

  it('never caches requests with a token, and forgets everything when the namespace is bumped', async () => {
    const { cache, interceptor, handler } = setup()
    await run(interceptor, handler, { url: '/api/x' })
    await new Promise((resolve) => setImmediate(resolve))
    expect(
      (await run(interceptor, handler, { url: '/api/x', headers: { authorization: 'Bearer t' } }))
        .body
    ).toEqual({
      n: 2,
    })
    await cache.bump('catalog')
    expect((await run(interceptor, handler, { url: '/api/x' })).body).toEqual({ n: 3 })
  })
})

describe('InMemoryResponseCache', () => {
  it('expires entries and keeps at most maxEntries', async () => {
    let now = 0
    const cache = new InMemoryResponseCache(2, () => now)
    await cache.set('a', '1', 10)
    await cache.set('b', '2', 10)
    await cache.set('c', '3', 10)
    expect(await cache.get('a')).toBeNull()
    expect(await cache.get('c')).toBe('3')
    now = 11_000
    expect(await cache.get('c')).toBeNull()
  })
})
