import { ConfigService } from '@nestjs/config'
import { InMemoryResponseCache } from '@shared/infrastructure/cache/response-caches'
import { PrismaService } from '@shared/infrastructure/persistence/prisma/prisma.service'
import { CatalogFreshnessListener } from './catalog-freshness.listener'

function setup(app: {
  storefrontRevalidateUrl: string | null
  storefrontRevalidateSecret: string | null
}) {
  const cache = new InMemoryResponseCache()
  const prisma = {
    product: { findMany: jest.fn(async () => [{ slug: 'drill' }, { slug: 'saw' }]) },
  } as unknown as PrismaService
  const config = { getOrThrow: () => app } as unknown as ConfigService
  const listener = new CatalogFreshnessListener(cache, prisma, config)
  const fetcher = jest.fn(async () => ({ ok: true, status: 200 }))
  listener.fetcher = fetcher as unknown as typeof fetch
  return { cache, listener, fetcher }
}

describe('CatalogFreshnessListener', () => {
  const configured = {
    storefrontRevalidateUrl: 'http://web/api/revalidate',
    storefrontRevalidateSecret: 's',
  }

  it('drops cached reads and tells the storefront which product pages changed', async () => {
    const { cache, listener, fetcher } = setup(configured)

    await listener.onCatalogChanged({ productIds: [1], variantIds: [5], everything: false })
    await listener.onCatalogChanged({ productIds: [2], variantIds: [], everything: false })
    await listener.flush()

    expect(await cache.version('catalog')).toBe(2)
    expect(fetcher).toHaveBeenCalledTimes(1)
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('http://web/api/revalidate')
    expect(init.headers).toMatchObject({ 'x-revalidate-secret': 's' })
    expect(JSON.parse(init.body as string)).toEqual({
      tags: ['catalog'],
      productSlugs: ['drill', 'saw'],
    })
  })

  it('revalidates the whole catalog after a category or brand change', async () => {
    const { listener, fetcher } = setup(configured)
    await listener.onCatalogChanged({ productIds: [], variantIds: [], everything: true })
    await listener.flush()
    const [, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit]
    expect(JSON.parse(init.body as string)).toEqual({ tags: ['catalog'], productSlugs: [] })
  })

  it('only clears the cache when revalidation is not configured, and survives an unreachable storefront', async () => {
    const off = setup({ storefrontRevalidateUrl: null, storefrontRevalidateSecret: null })
    await off.listener.onCatalogChanged({ productIds: [1], variantIds: [], everything: false })
    await off.listener.flush()
    expect(off.fetcher).not.toHaveBeenCalled()
    expect(await off.cache.version('catalog')).toBe(1)

    const down = setup(configured)
    down.fetcher.mockRejectedValueOnce(new Error('ECONNREFUSED'))
    await down.listener.onCatalogChanged({ productIds: [1], variantIds: [], everything: false })
    await expect(down.listener.flush()).resolves.toBeUndefined()
  })
})
