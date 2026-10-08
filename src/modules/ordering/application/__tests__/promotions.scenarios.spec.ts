import {
  CouponNotApplicableError,
  PromotionInput,
  PromotionKind,
  Promotion,
} from '@modules/promotions/domain/promotion.entity'
import { PaymentMethod } from '../../domain/enums/order.enums'
import { createCommerceHarness, defaultVariant } from './commerce-scenarios.support'

describe('Promotions at checkout', () => {
  const userId = 1
  const start = new Date('2020-01-01T00:00:00Z')

  /** Variant 11: 1,000,000 (category 7, brand 3). Variant 12: 500,000 (category 2). VAT 10%. */
  function setup() {
    const h = createCommerceHarness()
    h.storeSettings.current.vatRateBp = 1000
    h.seedCatalogVariant(defaultVariant(11, { categoryId: 7, categoryPath: '/1/', brandId: 3 }))
    h.seedCatalogVariant(
      defaultVariant(12, { unitPrice: 500_000, categoryId: 2, categoryPath: '/' })
    )
    h.seedStock(11, 10)
    h.seedStock(12, 10)
    h.seedUserBasket(userId, [
      { variantId: 11, quantity: 1 },
      { variantId: 12, quantity: 2 },
    ])
    const addressId = h.seedUserAddress(userId)
    return { h, addressId }
  }

  function promotion(overrides: Partial<PromotionInput> = {}) {
    return Promotion.create({
      name: 'Promo',
      code: 'SAVE10',
      kind: PromotionKind.Percent,
      value: 10,
      maxDiscount: null,
      minSubtotal: null,
      startsAt: start,
      endsAt: null,
      usageLimit: null,
      perCustomerLimit: null,
      categoryIds: null,
      brandIds: null,
      ...overrides,
    })
  }

  it('takes the coupon off the goods and charges VAT on what is left', async () => {
    const { h, addressId } = setup()
    await h.promotions.save(promotion())

    const preview = await h.previewCheckout.execute({ userId, addressId, couponCode: ' save10 ' })

    // subtotal 2,000,000; 10% = 200,000 spread 1,000,000 : 1,000,000.
    expect(preview.discountTotal).toBe(200_000)
    expect(preview.items.map((item) => item.discountAmount)).toEqual([100_000, 100_000])
    expect(preview.taxTotal).toBe(180_000) // 10% of 1,800,000
    expect(preview.total).toBe(2_000_000 - 200_000 + 180_000)
    expect(preview.promotion).toMatchObject({ code: 'SAVE10', kind: 'PERCENT' })
  })

  it('limits a discount to its categories', async () => {
    const { h, addressId } = setup()
    await h.promotions.save(promotion({ categoryIds: [1] })) // variant 11 is under category 1

    const preview = await h.previewCheckout.execute({ userId, addressId, couponCode: 'SAVE10' })

    expect(preview.items.map((item) => item.discountAmount)).toEqual([100_000, 0])
    expect(preview.discountTotal).toBe(100_000)
  })

  it('applies the better of coupon and campaign, never both', async () => {
    const { h, addressId } = setup()
    await h.promotions.save(promotion({ code: null, name: 'Campaign', value: 20 }))
    await h.promotions.save(promotion())

    const preview = await h.previewCheckout.execute({ userId, addressId, couponCode: 'SAVE10' })

    expect(preview.promotion?.name).toBe('Campaign')
    expect(preview.discountTotal).toBe(400_000)
    expect(preview.couponOutranked).toBe(true)
  })

  it('applies an automatic campaign without a code', async () => {
    const { h, addressId } = setup()
    await h.promotions.save(promotion({ code: null, kind: PromotionKind.Fixed, value: 300_000 }))

    const preview = await h.previewCheckout.execute({ userId, addressId })

    expect(preview.discountTotal).toBe(300_000)
    expect(preview.couponOutranked).toBe(false)
  })

  it('makes shipping free', async () => {
    const { h, addressId } = setup()
    await h.createShippingMethod.execute({ name: 'Post', code: 'post', baseFee: 600_000 })
    await h.promotions.save(
      promotion({ code: 'FREESHIP', kind: PromotionKind.FreeShipping, value: 0 })
    )

    const preview = await h.previewCheckout.execute({ userId, addressId, couponCode: 'FREESHIP' })

    expect(preview.shippingFee).toBe(600_000)
    expect(preview.discountTotal).toBe(600_000)
    expect(preview.taxTotal).toBe(200_000) // goods untouched
    expect(preview.total).toBe(2_000_000 + 600_000 - 600_000 + 200_000)
  })

  it.each([
    ['an unknown code', 'NOPE', {}],
    ['a code below its minimum', 'SAVE10', { minSubtotal: 5_000_000 }],
    ['an expired code', 'SAVE10', { endsAt: new Date('2021-01-01T00:00:00Z') }],
  ])('explains %s', async (_, code, overrides) => {
    const { h, addressId } = setup()
    await h.promotions.save(promotion(overrides))

    await expect(
      h.previewCheckout.execute({ userId, addressId, couponCode: code })
    ).rejects.toBeInstanceOf(CouponNotApplicableError)
  })

  it('records the discount on the order and charges the discounted total', async () => {
    const { h, addressId } = setup()
    const saved = await h.promotions.save(promotion())

    const order = await h.createOrder.execute({
      userId,
      addressId,
      paymentMethod: PaymentMethod.Online,
      couponCode: 'SAVE10',
    })
    const payment = await h.initiatePayment.execute({
      orderId: order.id,
      userId,
      idempotencyKey: 'promo-1',
    })

    expect(order.discountTotal).toBe(200_000)
    expect(order.total).toBe(1_980_000)
    expect(payment.amount).toBe(1_980_000)
    expect((await h.promotions.findById(saved.id))?.usedCount).toBe(1)
  })

  it('enforces the per-customer limit and frees the use when the order is cancelled', async () => {
    const { h, addressId } = setup()
    const saved = await h.promotions.save(promotion({ perCustomerLimit: 1 }))
    const first = await h.createOrder.execute({ userId, addressId, couponCode: 'SAVE10' })

    h.seedUserBasket(userId, [{ variantId: 11, quantity: 1 }])
    await expect(
      h.previewCheckout.execute({ userId, addressId, couponCode: 'SAVE10' })
    ).rejects.toBeInstanceOf(CouponNotApplicableError)

    await h.cancelOrder.execute({ orderId: first.id, userId })
    expect((await h.promotions.findById(saved.id))?.usedCount).toBe(0)
    await expect(
      h.previewCheckout.execute({ userId, addressId, couponCode: 'SAVE10' })
    ).resolves.toMatchObject({ discountTotal: 100_000 })
  })

  it('stops a code once its total usage limit is reached', async () => {
    const { h, addressId } = setup()
    await h.promotions.save(promotion({ usageLimit: 1 }))
    await h.createOrder.execute({ userId, addressId, couponCode: 'SAVE10' })

    const other = 2
    h.seedUserBasket(other, [{ variantId: 11, quantity: 1 }])
    const otherAddress = h.seedUserAddress(other, 2)
    await expect(
      h.previewCheckout.execute({ userId: other, addressId: otherAddress, couponCode: 'SAVE10' })
    ).rejects.toBeInstanceOf(CouponNotApplicableError)
  })
})
