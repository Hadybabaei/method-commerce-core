/**
 * Full order lifecycle against a real Postgres database, with the seed data
 * loaded (npm run prisma:deploy && npm run seed). Runs in CI; locally it
 * needs the docker-compose Postgres. Redis is not required (REDIS_ENABLED=false).
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

type Variant = {
  id: number
  sku: string
  price: number
  isActive: boolean
  availableQuantity: number
}
type Product = { slug: string; published: boolean; variants: Variant[] }

/** Fails with the response body, which says far more than a bare status mismatch. */
function ok(res: Response): Response {
  if (res.status >= 300) {
    throw new Error(`HTTP ${res.status}: ${JSON.stringify(res.body)}`)
  }
  return res
}

describe('Order lifecycle (e2e)', () => {
  let app: INestApplication
  let prefix: string
  let customer: string
  let admin: string

  const api = () => request(app.getHttpServer())
  const asCustomer = (req: request.Test) => req.set('authorization', `Bearer ${customer}`)
  const asAdmin = (req: request.Test) => req.set('authorization', `Bearer ${admin}`)
  const url = (path: string) => `/${prefix}${path}`

  // Product reads go out as the customer: anonymous catalog reads are cached for
  // up to a minute, and these checks need live stock.
  async function findSellableVariant(): Promise<{ slug: string; variant: Variant }> {
    const list = ok(await api().get(url('/products')).query({ limit: 50 }))
    for (const summary of list.body.items as { slug: string }[]) {
      const product = ok(
        await asCustomer(api().get(url(`/products/${encodeURIComponent(summary.slug)}`)))
      )
        .body as Product
      const variant = product.variants.find((v) => v.isActive && v.availableQuantity > 0)
      if (variant) return { slug: product.slug, variant }
    }
    throw new Error('Seed data has no product in stock')
  }

  async function stockOf(slug: string, variantId: number): Promise<number> {
    const product = ok(await asCustomer(api().get(url(`/products/${encodeURIComponent(slug)}`))))
      .body as Product
    return product.variants.find((v) => v.id === variantId)!.availableQuantity
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    prefix = app.get(ConfigService).getOrThrow<AppConfig>('app').apiPrefix
    configureHttp(app, prefix)
    await app.init()

    const otp = ok(
      await api().post(url('/auth/otp/request')).send({ phone_number: CUSTOMER_PHONE })
    )
    expect(otp.body.code).toBeDefined() // OTP_EXPOSE_IN_RESPONSE=true in CI
    const verified = ok(
      await api()
        .post(url('/auth/otp/verify'))
        .send({ phone_number: CUSTOMER_PHONE, otp_code: otp.body.code })
    )
    customer = verified.body.accessToken

    const login = ok(
      await api()
        .post(url('/admin/auth/login'))
        .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
    )
    admin = login.body.accessToken
  })

  afterAll(async () => {
    await app?.close()
  })

  it('takes a COD order from checkout through delivery, return and refund', async () => {
    ok(await asAdmin(api().put(url('/admin/settings'))).send({ vat_rate_bp: 1000 }))

    const { slug, variant } = await findSellableVariant()
    const stockBefore = variant.availableQuantity

    ok(await asCustomer(api().delete(url('/users/me/basket'))))
    ok(
      await asCustomer(api().post(url('/users/me/basket/items'))).send({
        variant_id: variant.id,
        quantity: 1,
      })
    )
    const addresses = ok(await asCustomer(api().get(url('/users/me/addresses')))).body
    const addressId = (Array.isArray(addresses) ? addresses : addresses.items)[0].id

    // Checkout: VAT is added on top of the subtotal and shipping.
    const preview = ok(
      await asCustomer(api().post(url('/orders/preview'))).send({ address_id: addressId })
    ).body
    expect(preview.taxRateBp).toBe(1000)
    expect(preview.total).toBe(preview.subtotal + preview.shippingFee + preview.taxTotal)

    const placed = ok(
      await asCustomer(api().post(url('/orders'))).send({
        address_id: addressId,
        payment_method: 'CASH_ON_DELIVERY',
        shipping_method_id: preview.shippingMethodId ?? undefined,
      })
    ).body
    expect(placed.status).toBe('PENDING')
    expect(placed.total).toBe(preview.total)
    expect(await stockOf(slug, variant.id)).toBe(stockBefore - 1)

    // Fulfilment.
    const orderUrl = url(`/admin/orders/${placed.id}`)
    ok(await asAdmin(api().post(`${orderUrl}/confirm-payment`)))
    ok(await asAdmin(api().post(`${orderUrl}/process`)))
    const shipped = ok(
      await asAdmin(api().post(`${orderUrl}/ship`)).send({ tracking_code: 'E2E-TRACK-1' })
    ).body
    expect(shipped.shipping.trackingCode).toBe('E2E-TRACK-1')
    const delivered = ok(await asAdmin(api().post(`${orderUrl}/complete`))).body
    expect(delivered.status).toBe('COMPLETED')
    expect(delivered.statusHistory.map((e: { to: string }) => e.to)).toEqual([
      'PENDING',
      'PAID',
      'PROCESSING',
      'SHIPPED',
      'COMPLETED',
    ])
    expect(delivered.returnableUntil).not.toBeNull()

    // Invoice.
    const invoice = ok(await asCustomer(api().get(url(`/orders/${placed.id}/invoice`)))).body
    expect(invoice.number).toBe(placed.number)
    expect(invoice.total).toBe(placed.total)

    // Return and refund.
    const line = delivered.items[0]
    const requested = ok(
      await asCustomer(api().post(url(`/orders/${placed.id}/returns`))).send({
        items: [{ order_item_id: line.id, quantity: 1 }],
        reason: 'آزمون خودکار مرجوعی',
      })
    ).body
    const returnId = requested.returns[0].id

    const queue = ok(
      await asAdmin(api().get(url('/admin/returns'))).query({ status: 'REQUESTED' })
    ).body
    expect(queue.items.map((r: { id: number }) => r.id)).toContain(returnId)
    ok(await asAdmin(api().post(url(`/admin/returns/${returnId}/approve`))).send({}))

    const refundAmount = line.lineTotal + line.taxAmount
    const refunded = ok(
      await asAdmin(api().post(`${orderUrl}/refunds`)).send({
        amount: refundAmount,
        reference: 'E2E-REF-1',
        return_request_id: returnId,
        restock: true,
      })
    ).body
    expect(refunded.refundedTotal).toBe(refundAmount)
    expect(refunded.returns[0].status).toBe('REFUNDED')
    expect(await stockOf(slug, variant.id)).toBe(stockBefore)

    // Refunds can never exceed what was paid.
    const tooMuch = await asAdmin(api().post(`${orderUrl}/refunds`)).send({
      amount: placed.total,
      reference: 'E2E-REF-2',
    })
    expect(tooMuch.status).toBe(422)
  })
})
