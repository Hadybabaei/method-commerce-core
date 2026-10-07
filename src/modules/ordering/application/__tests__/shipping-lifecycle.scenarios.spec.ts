import {
  OrderNotProcessableError,
  OrderNotShippableError,
  ShippingMethodCodeTakenError,
  ShippingMethodNotOfferedError,
  ShippingUnavailableError,
} from '../../domain/errors/ordering.errors'
import { OrderStatus, PaymentMethod } from '../../domain/enums/order.enums'
import { createCommerceHarness, defaultVariant, phoneFor } from './commerce-scenarios.support'

describe('Shipping and order lifecycle scenarios', () => {
  const userId = 1
  const variantId = 11
  // defaultVariant: 1,000,000 Rial and 500 g per unit; the seeded address is in province 1.

  function readyCheckout(qty = 2) {
    const h = createCommerceHarness()
    h.seedCatalogVariant(defaultVariant(variantId))
    h.seedStock(variantId, 10)
    h.seedUserBasket(userId, [{ variantId, quantity: qty }])
    const addressId = h.seedUserAddress(userId)
    return { h, addressId }
  }

  async function seedMethods(h: ReturnType<typeof createCommerceHarness>) {
    const post = await h.createShippingMethod.execute({
      name: 'Post',
      code: 'post',
      baseFee: 500_000,
      perKgFee: 100_000,
      freeAbove: 10_000_000,
      minDays: 3,
      maxDays: 5,
      trackingUrlTemplate: 'https://tracking.post.ir/?id={code}',
    })
    const courier = await h.createShippingMethod.execute({
      name: 'Tehran courier',
      code: 'courier',
      baseFee: 900_000,
      provinceIds: [1],
    })
    const north = await h.createShippingMethod.execute({
      name: 'North only',
      code: 'north',
      baseFee: 100_000,
      provinceIds: [2],
    })
    return { post, courier, north }
  }

  describe('Checkout quotes', () => {
    it('ships for free when the store has no shipping methods', async () => {
      const { h, addressId } = readyCheckout(2)

      const preview = await h.previewCheckout.execute({ userId, addressId })

      expect(preview.shippingMethods).toEqual([])
      expect(preview.shippingMethodId).toBeNull()
      expect(preview.shippingFee).toBe(0)
      expect(preview.total).toBe(2_000_000)
      expect(preview.weightGrams).toBe(1000)
    })

    it('offers only methods serving the province, cheapest first, and selects the cheapest', async () => {
      const { h, addressId } = readyCheckout(2)
      const { post, courier } = await seedMethods(h)

      const preview = await h.previewCheckout.execute({ userId, addressId })

      // 1000 g = 1 started kg: post = 500,000 + 100,000.
      expect(preview.shippingMethods.map((m) => [m.id, m.fee])).toEqual([
        [post.id, 600_000],
        [courier.id, 900_000],
      ])
      expect(preview.shippingMethodId).toBe(post.id)
      expect(preview.shippingFee).toBe(600_000)
      expect(preview.total).toBe(2_600_000)
    })

    it('charges every started kilogram', async () => {
      const { h, addressId } = readyCheckout(3)
      await seedMethods(h)

      const preview = await h.previewCheckout.execute({ userId, addressId })

      // 1500 g = 2 started kg.
      expect(preview.shippingFee).toBe(700_000)
    })

    it('waives the fee once the subtotal reaches free_above', async () => {
      const { h, addressId } = readyCheckout(10)
      await seedMethods(h)

      const preview = await h.previewCheckout.execute({ userId, addressId })

      expect(preview.subtotal).toBe(10_000_000)
      expect(preview.shippingFee).toBe(0)
      expect(preview.total).toBe(10_000_000)
    })

    it('uses the method the customer picked', async () => {
      const { h, addressId } = readyCheckout(2)
      const { courier } = await seedMethods(h)

      const preview = await h.previewCheckout.execute({
        userId,
        addressId,
        shippingMethodId: courier.id,
      })

      expect(preview.shippingMethodId).toBe(courier.id)
      expect(preview.total).toBe(2_900_000)
    })

    it('refuses a method that does not serve the address', async () => {
      const { h, addressId } = readyCheckout(2)
      const { north } = await seedMethods(h)

      await expect(
        h.previewCheckout.execute({ userId, addressId, shippingMethodId: north.id })
      ).rejects.toBeInstanceOf(ShippingMethodNotOfferedError)
    })

    it('refuses the order when methods exist but none serve the province', async () => {
      const { h, addressId } = readyCheckout(2)
      await h.createShippingMethod.execute({
        name: 'North only',
        code: 'north',
        baseFee: 100_000,
        provinceIds: [2],
      })

      await expect(h.createOrder.execute({ userId, addressId })).rejects.toBeInstanceOf(
        ShippingUnavailableError
      )
      expect(h.inventory.snapshot(variantId)[0].reserved).toBe(0)
    })

    it('rejects a duplicate method code', async () => {
      const { h } = readyCheckout()
      await seedMethods(h)

      await expect(
        h.createShippingMethod.execute({ name: 'Post 2', code: 'post', baseFee: 1 })
      ).rejects.toBeInstanceOf(ShippingMethodCodeTakenError)
    })
  })

  describe('Placed orders', () => {
    it('freezes the method, fee and total on the order', async () => {
      const { h, addressId } = readyCheckout(2)
      const { courier } = await seedMethods(h)

      const order = await h.createOrder.execute({
        userId,
        addressId,
        paymentMethod: PaymentMethod.CashOnDelivery,
        shippingMethodId: courier.id,
      })

      expect(order.shippingFee).toBe(900_000)
      expect(order.total).toBe(2_900_000)
      expect(order.shipping).toMatchObject({
        method: { id: courier.id, name: 'Tehran courier', code: 'courier' },
        fee: 900_000,
        weightGrams: 1000,
      })
    })

    it('asks the gateway for the total including shipping', async () => {
      const { h, addressId } = readyCheckout(2)
      await seedMethods(h)
      const order = await h.createOrder.execute({
        userId,
        addressId,
        paymentMethod: PaymentMethod.Online,
      })

      const payment = await h.initiatePayment.execute({
        orderId: order.id,
        userId,
        idempotencyKey: 'pay-1',
      })

      expect(payment.amount).toBe(2_600_000)
    })
  })

  describe('Fulfilment', () => {
    async function paidCodOrder() {
      const { h, addressId } = readyCheckout(2)
      await seedMethods(h)
      const order = await h.createOrder.execute({
        userId,
        addressId,
        paymentMethod: PaymentMethod.CashOnDelivery,
      })
      await h.confirmCod.execute({ orderId: order.id })
      return { h, orderId: order.id }
    }

    it('moves PAID → PROCESSING → SHIPPED → COMPLETED and records every step', async () => {
      const { h, orderId } = await paidCodOrder()

      await h.processOrder.execute({ orderId })
      const shipped = await h.shipOrder.execute({ orderId, trackingCode: 'TRK 42' })
      const completed = await h.completeOrder.execute({ orderId })

      expect(shipped.status).toBe(OrderStatus.Shipped)
      expect(shipped.shipping.trackingCode).toBe('TRK 42')
      expect(shipped.shipping.trackingUrl).toBe('https://tracking.post.ir/?id=TRK%2042')
      expect(completed.status).toBe(OrderStatus.Completed)
      expect(completed.processingAt).not.toBeNull()
      expect(completed.shippedAt).not.toBeNull()
      expect(completed.statusHistory.map((e) => [e.from, e.to])).toEqual([
        [null, OrderStatus.Pending],
        [OrderStatus.Pending, OrderStatus.Paid],
        [OrderStatus.Paid, OrderStatus.Processing],
        [OrderStatus.Processing, OrderStatus.Shipped],
        [OrderStatus.Shipped, OrderStatus.Completed],
      ])
      expect(completed.statusHistory[3].note).toBe('Tracking code TRK 42')
    })

    it('lets a paid order ship directly and corrects tracking without a second event', async () => {
      const { h, orderId } = await paidCodOrder()

      await h.shipOrder.execute({ orderId, trackingCode: 'WRONG' })
      const fixed = await h.shipOrder.execute({
        orderId,
        trackingCode: 'RIGHT',
        trackingUrl: 'https://carrier.example/t/RIGHT',
      })

      expect(fixed.shipping.trackingCode).toBe('RIGHT')
      expect(fixed.shipping.trackingUrl).toBe('https://carrier.example/t/RIGHT')
      expect(fixed.statusHistory.filter((e) => e.to === OrderStatus.Shipped)).toHaveLength(1)
      expect(h.sms.sent.filter((s) => s.text.includes('ارسال شد'))).toHaveLength(1)
    })

    it('refuses to process or ship an unpaid order', async () => {
      const { h, addressId } = readyCheckout(1)
      const order = await h.createOrder.execute({ userId, addressId })

      await expect(h.processOrder.execute({ orderId: order.id })).rejects.toBeInstanceOf(
        OrderNotProcessableError
      )
      await expect(h.shipOrder.execute({ orderId: order.id })).rejects.toBeInstanceOf(
        OrderNotShippableError
      )
    })

    it('texts the customer at every step', async () => {
      const { h, orderId } = await paidCodOrder()
      await h.processOrder.execute({ orderId })
      await h.shipOrder.execute({ orderId, trackingCode: 'TRK1' })
      await h.completeOrder.execute({ orderId })

      expect(h.sms.sent.every((s) => s.phoneNumber === phoneFor(userId))).toBe(true)
      expect(h.sms.sent.map((s) => s.text.split('\n')[0])).toEqual([
        expect.stringContaining('ثبت شد'),
        expect.stringContaining('پرداخت'),
        expect.stringContaining('آماده‌سازی'),
        expect.stringContaining('ارسال شد'),
        expect.stringContaining('تحویل شد'),
      ])
      expect(h.sms.sent[3].text).toContain('کد رهگیری: TRK1')
    })

    it('does not text an online order until it is paid', async () => {
      const { h, addressId } = readyCheckout(1)
      await h.createOrder.execute({ userId, addressId, paymentMethod: PaymentMethod.Online })

      expect(h.sms.sent).toEqual([])
    })
  })
})
