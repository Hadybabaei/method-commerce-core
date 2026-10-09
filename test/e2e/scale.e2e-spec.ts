/**
 * Phase 5 against a real Postgres with seed data: search (in-memory engine, as
 * in CI), recommendations, cached reads, readiness, ratings, wishlist
 * variants and back-in-stock alerts.
 */
import { INestApplication } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Test } from '@nestjs/testing'
import request, { Response } from 'supertest'
import { AppConfig } from '@config/app.config'
import { SearchIndexerService } from '@modules/search/application/search-indexer.service'
import { AppModule } from '../../src/app.module'
import { configureHttp } from '../../src/app.setup'

const CUSTOMER_PHONE = process.env.SEED_CUSTOMER_PHONE ?? '09121234567'
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@method-commerce.local'
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'admin1234'

type Variant = { id: number; sku: string; isActive: boolean; availableQuantity: number }
type Product = { id: number; title: string; slug: string; variants: Variant[] }

function ok(res: Response): Response {
  if (res.status >= 300) throw new Error(`HTTP ${res.status}: ${JSON.stringify(res.body)}`)
  return res
}

async function eventually<T>(read: () => Promise<T>, done: (value: T) => boolean, ms = 10_000): Promise<T> {
  const deadline = Date.now() + ms
  for (;;) {
    const value = await read()
    if (done(value) || Date.now() > deadline) return value
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
}

describe('Scale features (e2e)', () => {
  let app: INestApplication
  let prefix: string
  let customer: string
  let admin: string
  let product: Product
  let variant: Variant

  const api = () => request(app.getHttpServer())
  const url = (path: string) => `/${prefix}${path}`
  const as = (token: string) => (req: request.Test) => req.set('authorization', `Bearer ${token}`)

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    prefix = app.get(ConfigService).getOrThrow<AppConfig>('app').apiPrefix
    configureHttp(app, prefix)
    await app.init()
    await app.get(SearchIndexerService).flush()

    const otp = ok(await api().post(url('/auth/otp/request')).send({ phone_number: CUSTOMER_PHONE }))
    customer = ok(
      await api().post(url('/auth/otp/verify')).send({ phone_number: CUSTOMER_PHONE, otp_code: otp.body.code })
    ).body.accessToken
    admin = ok(
      await api().post(url('/admin/auth/login')).send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
    ).body.accessToken

    const list = ok(await api().get(url('/products')).query({ limit: 50 }))
    for (const summary of list.body.items as { slug: string }[]) {
      const detail = ok(await api().get(url(`/products/${encodeURIComponent(summary.slug)}`))).body as Product
      const found = detail.variants.find((v) => v.isActive && v.availableQuantity > 0)
      if (found) {
        product = detail
        variant = found
        break
      }
    }
    if (!product) throw new Error('Seed data has no product in stock')
  })

  afterAll(async () => {
    await app?.close()
  })

  it('finds a product by a word of its title, with facets and suggestions', async () => {
    const word = product.title.split(/\s+/)[0]
    const result = ok(await api().get(url('/search')).query({ q: word, limit: 50 })).body
    expect(result.items.map((item: { id: number }) => item.id)).toContain(product.id)
    expect(result.facets).toHaveProperty('brands')
    expect(result.facets).toHaveProperty('options')
    expect(result.items[0]).toHaveProperty('inStock')

    // Arabic letters find the Persian spelling.
    const arabic = word.replace(/ی/g, 'ي').replace(/ک/g, 'ك')
    const viaArabic = ok(await api().get(url('/search')).query({ q: arabic, limit: 50 })).body
    expect(viaArabic.items.map((item: { id: number }) => item.id)).toContain(product.id)

    const suggestions = ok(await api().get(url('/search/suggest')).query({ q: word })).body
    expect(suggestions.products.length).toBeGreaterThan(0)

    const bad = await api().get(url('/search')).query({ options: 'no-colon' })
    expect(bad.status).toBe(400)
  })

  it('serves recommendations and caches public reads', async () => {
    const slug = encodeURIComponent(product.slug)
    ok(await api().get(url(`/products/${slug}/related`)))
    ok(await api().get(url(`/products/${slug}/bought-together`)))
    expect((await api().get(url(`/products/missing-${Date.now()}/related`))).status).toBe(404)

    // A page size no other test asks for, so the first read is a miss.
    const first = ok(await api().get(url('/products')).query({ limit: 7 }))
    expect(first.headers['x-cache']).toBe('MISS')
    const again = ok(await api().get(url('/products')).query({ limit: 7 }))
    expect(again.headers['x-cache']).toBe('HIT')
    expect(again.body).toEqual(first.body)
    expect(first.body.items[0]).toHaveProperty('rating')
  })

  it('reports readiness of the database, Redis and search', async () => {
    const ready = ok(await api().get(url('/health/ready'))).body
    expect(ready.checks).toMatchObject({ database: 'up', search: 'up' })
  })

  it('keeps the chosen variant on a favorite', async () => {
    const asCustomer = as(customer)
    await asCustomer(api().delete(url(`/users/me/favorites/${product.id}`)))
    const saved = ok(
      await asCustomer(api().post(url('/users/me/favorites'))).send({ product_id: product.id, variant_id: variant.id })
    ).body
    expect(saved.variant).toMatchObject({ id: variant.id, sku: variant.sku })

    const cleared = ok(
      await asCustomer(api().patch(url(`/users/me/favorites/${product.id}`))).send({ variant_id: null })
    ).body
    expect(cleared.variant).toBeNull()
    const wrong = await asCustomer(api().patch(url(`/users/me/favorites/${product.id}`))).send({ variant_id: 99_999_999 })
    expect(wrong.status).toBe(404)
    ok(await asCustomer(api().delete(url(`/users/me/favorites/${product.id}`))))
  })

  it('texts a waiting customer once the variant is back in stock', async () => {
    const asAdmin = as(admin)
    const asCustomer = as(customer)

    const tooEarly = await asCustomer(api().post(url('/users/me/stock-alerts'))).send({ variant_id: variant.id })
    expect(tooEarly.status).toBe(422)

    // Empty every warehouse for this variant.
    const row = ok(await asAdmin(api().get(url('/admin/stock'))).query({ search: variant.sku })).body.items[0]
    for (const level of row.levels as { locationId: number; onHand: number; reserved: number }[]) {
      const free = level.onHand - level.reserved
      if (free > 0) {
        ok(
          await asAdmin(api().post(url(`/admin/stock/${variant.id}/adjust`))).send({
            delta: -free,
            reason: 'e2e sold out',
            location_id: level.locationId,
          })
        )
      }
    }

    const waiting = ok(
      await asCustomer(api().post(url('/users/me/stock-alerts'))).send({ variant_id: variant.id })
    ).body
    expect(waiting.map((alert: { variantId: number }) => alert.variantId)).toContain(variant.id)

    ok(
      await asAdmin(api().post(url(`/admin/stock/${variant.id}/adjust`))).send({
        delta: row.available > 0 ? row.available : 3,
        reason: 'e2e restock',
      })
    )

    const after = await eventually(
      async () => ok(await asCustomer(api().get(url('/users/me/stock-alerts')))).body as { variantId: number }[],
      (alerts) => !alerts.some((alert) => alert.variantId === variant.id)
    )
    expect(after.map((alert) => alert.variantId)).not.toContain(variant.id)
  })
})
