/**
 * Phase 4 back office against a real MySQL with seed data: coupons at
 * checkout, the reports' SQL, stock adjustments, customer blocking,
 * permissions and the audit log.
 */
import { INestApplication } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Test } from '@nestjs/testing'
import request, { Response } from 'supertest'
import { AppConfig } from '@config/app.config'
import { AppModule } from '../../src/app.module'
import { configureHttp } from '../../src/app.setup'

const CUSTOMER_PHONE = process.env.SEED_CUSTOMER_PHONE ?? '09121234567'
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@method-commerce.local'
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'admin1234'

type Variant = { id: number; sku: string; isActive: boolean; availableQuantity: number }

function ok(res: Response): Response {
  if (res.status >= 300) {
    throw new Error(`HTTP ${res.status}: ${JSON.stringify(res.body)}`)
  }
  return res
}

describe('Back office (e2e)', () => {
  let app: INestApplication
  let prefix: string
  let customer: string
  let admin: string

  const api = () => request(app.getHttpServer())
  const url = (path: string) => `/${prefix}${path}`
  const as = (token: string) => (req: request.Test) => req.set('authorization', `Bearer ${token}`)

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    prefix = app.get(ConfigService).getOrThrow<AppConfig>('app').apiPrefix
    configureHttp(app, prefix)
    await app.init()

    const otp = ok(
      await api().post(url('/auth/otp/request')).send({ phone_number: CUSTOMER_PHONE })
    )
    customer = ok(
      await api()
        .post(url('/auth/otp/verify'))
        .send({ phone_number: CUSTOMER_PHONE, otp_code: otp.body.code })
    ).body.accessToken
    admin = ok(
      await api()
        .post(url('/admin/auth/login'))
        .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
    ).body.accessToken
  })

  afterAll(async () => {
    await app?.close()
  })

  async function sellableVariant(): Promise<Variant> {
    const list = ok(await api().get(url('/products')).query({ limit: 50 }))
    for (const summary of list.body.items as { slug: string }[]) {
      const product = ok(await api().get(url(`/products/${encodeURIComponent(summary.slug)}`))).body
      const variant = (product.variants as Variant[]).find(
        (v) => v.isActive && v.availableQuantity > 0
      )
      if (variant) return variant
    }
    throw new Error('Seed data has no product in stock')
  }

  it('applies a coupon at checkout with VAT after the discount', async () => {
    const asAdmin = as(admin)
    const asCustomer = as(customer)
    const variant = await sellableVariant()
    const code = `E2E${Date.now()}`

    ok(
      await asAdmin(api().post(url('/admin/promotions'))).send({
        name: 'e2e coupon',
        code,
        kind: 'PERCENT',
        value: 10,
        starts_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      })
    )
    ok(await asCustomer(api().delete(url('/users/me/basket'))))
    ok(
      await asCustomer(api().post(url('/users/me/basket/items'))).send({
        variant_id: variant.id,
        quantity: 1,
      })
    )
    const addresses = ok(await asCustomer(api().get(url('/users/me/addresses')))).body
    const addressId = (Array.isArray(addresses) ? addresses : addresses.items)[0].id

    const preview = ok(
      await asCustomer(api().post(url('/orders/preview'))).send({
        address_id: addressId,
        coupon_code: code.toLowerCase(),
      })
    ).body
    expect(preview.promotion?.code).toBe(code)
    expect(preview.discountTotal).toBeGreaterThan(0)
    expect(preview.total).toBe(
      preview.subtotal + preview.shippingFee - preview.discountTotal + preview.taxTotal
    )

    const order = ok(
      await asCustomer(api().post(url('/orders'))).send({
        address_id: addressId,
        payment_method: 'CASH_ON_DELIVERY',
        coupon_code: code,
      })
    ).body
    expect(order.discountTotal).toBe(preview.discountTotal)
    ok(await asAdmin(api().post(url(`/admin/orders/${order.id}/confirm-payment`))))

    // The reports' SQL runs against MySQL here.
    const dashboard = ok(await asAdmin(api().get(url('/admin/reports/dashboard')))).body
    expect(dashboard.today.orders).toBeGreaterThanOrEqual(1)
    expect(dashboard.month.sales).toBeGreaterThan(0)
    expect(
      (ok(await asAdmin(api().get(url('/admin/reports/sales')))).body as unknown[]).length
    ).toBeGreaterThan(0)
    const top = ok(await asAdmin(api().get(url('/admin/reports/top-products')))).body
    expect(top[0].units).toBeGreaterThanOrEqual(1)
    ok(await asAdmin(api().get(url('/admin/reports/categories'))))
    ok(await asAdmin(api().get(url('/admin/reports/payment-conversion'))))
    const csv = ok(await asAdmin(api().get(url('/admin/reports/orders.csv'))))
    expect(csv.headers['content-type']).toContain('text/csv')
    expect(csv.text).toContain(order.number)
  })

  it('adjusts stock with a reason and flags low stock', async () => {
    const asAdmin = as(admin)
    const variant = await sellableVariant()
    const row = ok(await asAdmin(api().get(url('/admin/stock'))).query({ search: variant.sku }))
      .body.items[0]

    const flagged = ok(
      await asAdmin(api().put(url(`/admin/stock/${row.variantId}/threshold`))).send({
        low_stock_threshold: row.available + 1,
      })
    ).body
    expect(flagged.isLow).toBe(true)
    const low = ok(await asAdmin(api().get(url('/admin/stock'))).query({ low_only: true })).body
    expect(low.items.map((item: { variantId: number }) => item.variantId)).toContain(row.variantId)

    const adjusted = ok(
      await asAdmin(api().post(url(`/admin/stock/${row.variantId}/adjust`))).send({
        delta: 3,
        reason: 'e2e recount',
      })
    ).body
    expect(adjusted.available).toBe(row.available + 3)
    const tooFew = await asAdmin(api().post(url(`/admin/stock/${row.variantId}/adjust`))).send({
      delta: -(adjusted.onHand + 1),
      reason: 'e2e too many',
    })
    expect(tooFew.status).toBe(422)
    const movements = ok(
      await asAdmin(api().get(url(`/admin/stock/${row.variantId}/movements`)))
    ).body
    expect(movements[0]).toMatchObject({ delta: 3, reason: 'e2e recount' })
  })

  it('blocks and unblocks a customer', async () => {
    const asAdmin = as(admin)
    const asCustomer = as(customer)
    const found = ok(
      await asAdmin(api().get(url('/admin/customers'))).query({ search: CUSTOMER_PHONE })
    ).body.items[0]

    ok(await asAdmin(api().post(url(`/admin/customers/${found.id}/block`))))
    expect((await asCustomer(api().get(url('/users/me')))).status).toBe(403)
    ok(await asAdmin(api().post(url(`/admin/customers/${found.id}/unblock`))))
    ok(await asCustomer(api().get(url('/users/me'))))
  })

  it('limits an operator to their permissions and audits account changes', async () => {
    const asAdmin = as(admin)
    const email = `op${Date.now()}@method-commerce.local`
    const password = 'Operator!2345'
    ok(
      await asAdmin(api().post(url('/admin/accounts'))).send({
        email,
        password,
        role: 'operator',
        permissions: ['orders'],
      })
    )
    const operator = ok(await api().post(url('/admin/auth/login')).send({ email, password })).body
      .accessToken

    expect((await as(operator)(api().get(url('/admin/reports/dashboard')))).status).toBe(403)
    ok(await as(operator)(api().get(url('/admin/orders'))))

    const audit = ok(
      await asAdmin(api().get(url('/admin/audit-log'))).query({ entity: 'accounts' })
    ).body
    expect(audit.items[0].payload.email).toBe(email)
    expect(audit.items[0].payload.password).toBe('[redacted]')
  })
})
