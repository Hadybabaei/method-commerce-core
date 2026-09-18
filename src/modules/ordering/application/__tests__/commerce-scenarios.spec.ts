import { AddressNotFoundError, AddressNotOwnedError } from '@modules/addressing/domain/errors/addressing.errors'
import {
  BasketNotReadyError,
  EmptyBasketError,
  IdempotencyConflictError,
  InsufficientStockForOrderError,
  InvalidOrderNoteError,
  OrderNotCancellableError,
  OrderNotCompletableError,
  OrderNotOwnedError,
  OrderNotPayableError,
  PaymentAlreadyInProgressError,
  PaymentNotFoundError,
} from '../../domain/errors/ordering.errors'
import {
  OrderReservationStatus,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from '../../domain/enums/order.enums'
import {
  createCommerceHarness,
  defaultVariant,
  TEST_UNPAID_CANCEL_DELAY_MS,
} from './commerce-scenarios.support'

describe('Commerce scenarios', () => {
  const userId = 1
  const otherUserId = 2
  const variantId = 11

  function readyCheckout(stock = 10, qty = 2) {
    const h = createCommerceHarness()
    h.seedCatalogVariant(defaultVariant(variantId, { availableQuantity: stock }))
    h.seedStock(variantId, stock)
    h.seedUserBasket(userId, [{ variantId, quantity: qty }])
    const addressId = h.seedUserAddress(userId)
    return { h, addressId }
  }

  describe('Create order', () => {
    it('places an order from the basket, reserves stock, and clears the basket', async () => {
      const { h, addressId } = readyCheckout(10, 2)

      const order = await h.createOrder.execute({
        userId,
        addressId,
        paymentMethod: PaymentMethod.CashOnDelivery,
      })

      expect(order.status).toBe(OrderStatus.Pending)
      expect(order.itemCount).toBe(2)
      expect(order.subtotal).toBe(2_000_000)
      expect(order.items[0].unitPrice).toBe(1_000_000)
      expect(h.inventory.snapshot(variantId)[0].reserved).toBe(2)
      expect(h.inventory.snapshot(variantId)[0].onHand).toBe(10)
      expect(await h.baskets.getByUserId(userId)).toMatchObject({ items: [] })
      expect(h.orders.byId.get(order.id)?.reservationStatus).toBe(OrderReservationStatus.Reserved)
    })

    it('notifies the customer and every admin when an order is placed', async () => {
      const { h, addressId } = readyCheckout(5, 1)

      const order = await h.createOrder.execute({
        userId,
        addressId,
        paymentMethod: PaymentMethod.Online,
      })

      expect(h.notifications.sent).toHaveLength(1)
      const notice = h.notifications.sent[0]
      expect(notice.context).toBe('ordering')
      expect(notice.type).toBe('order.created')
      expect(notice.data).toMatchObject({ orderId: order.id, number: order.number, userId })
      expect(notice.recipients).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ audience: 'user', userId }),
          expect.objectContaining({ audience: 'admin', allAdmins: true }),
        ])
      )
    })

    it('rejects an empty basket', async () => {
      const h = createCommerceHarness()
      const addressId = h.seedUserAddress(userId)

      await expect(
        h.createOrder.execute({ userId, addressId })
      ).rejects.toBeInstanceOf(EmptyBasketError)
    })

    it('rejects a basket with stock issues', async () => {
      const { h, addressId } = readyCheckout(10, 2)
      h.baskets.setIssues(userId, variantId, ['INSUFFICIENT_STOCK'])

      await expect(
        h.createOrder.execute({ userId, addressId })
      ).rejects.toBeInstanceOf(BasketNotReadyError)
    })

    it('rejects a missing address', async () => {
      const { h } = readyCheckout()

      await expect(
        h.createOrder.execute({ userId, addressId: 999 })
      ).rejects.toBeInstanceOf(AddressNotFoundError)
    })

    it('rejects an address owned by someone else', async () => {
      const { h } = readyCheckout()
      h.seedUserAddress(otherUserId, 99)

      await expect(
        h.createOrder.execute({ userId, addressId: 99 })
      ).rejects.toBeInstanceOf(AddressNotOwnedError)
    })

    it('rejects a note that is too long', async () => {
      const { h, addressId } = readyCheckout()

      await expect(
        h.createOrder.execute({ userId, addressId, note: 'x'.repeat(1001) })
      ).rejects.toBeInstanceOf(InvalidOrderNoteError)
    })

    it('creates ONLINE and COD orders as PENDING with reserved stock', async () => {
      for (const method of [PaymentMethod.CashOnDelivery, PaymentMethod.Online]) {
        const { h, addressId } = readyCheckout(5, 1)
        const order = await h.createOrder.execute({
          userId,
          addressId,
          paymentMethod: method,
        })
        expect(order.status).toBe(OrderStatus.Pending)
        expect(order.paymentMethod).toBe(method)
        expect(h.inventory.available(variantId)).toBe(4)
      }
    })
  })

  describe('Inventory', () => {
    it('allows ordering the exact available quantity', async () => {
      const { h, addressId } = readyCheckout(3, 3)

      const order = await h.createOrder.execute({ userId, addressId })

      expect(order.itemCount).toBe(3)
      expect(h.inventory.available(variantId)).toBe(0)
      expect(h.inventory.snapshot(variantId)[0].reserved).toBe(3)
    })

    it('rejects when requested quantity exceeds available stock', async () => {
      const { h, addressId } = readyCheckout(2, 5)

      await expect(
        h.createOrder.execute({ userId, addressId })
      ).rejects.toBeInstanceOf(InsufficientStockForOrderError)

      expect(h.inventory.snapshot(variantId)[0].reserved).toBe(0)
    })

    it('splits a line across multiple warehouse locations', async () => {
      const h = createCommerceHarness()
      h.seedCatalogVariant(defaultVariant(variantId))
      h.seedStock(variantId, 2, 1)
      h.seedStock(variantId, 3, 2)
      h.seedUserBasket(userId, [{ variantId, quantity: 4 }])
      const addressId = h.seedUserAddress(userId)

      const order = await h.createOrder.execute({ userId, addressId })
      const plan = h.orders.byId.get(order.id)!.stockAllocations

      expect(plan.allocations).toEqual([
        { variantId, locationId: 1, quantity: 2 },
        { variantId, locationId: 2, quantity: 2 },
      ])
      expect(h.inventory.available(variantId)).toBe(1)
    })

    it('releases multi-location reservations on cancel', async () => {
      const h = createCommerceHarness()
      h.seedCatalogVariant(defaultVariant(variantId))
      h.seedStock(variantId, 2, 1)
      h.seedStock(variantId, 2, 2)
      h.seedUserBasket(userId, [{ variantId, quantity: 3 }])
      const addressId = h.seedUserAddress(userId)

      const order = await h.createOrder.execute({ userId, addressId })
      await h.cancelOrder.execute({ orderId: order.id, userId })

      expect(h.inventory.snapshot(variantId).map((l) => l.reserved)).toEqual([0, 0])
      expect(h.inventory.available(variantId)).toBe(4)
    })
  })

  describe('Concurrent checkout race', () => {
    it('allows only one of two concurrent orders when stock is 1', async () => {
      const h = createCommerceHarness()
      h.seedCatalogVariant(defaultVariant(variantId, { availableQuantity: 1 }))
      h.seedStock(variantId, 1)
      h.seedUserBasket(userId, [{ variantId, quantity: 1 }])
      h.seedUserBasket(otherUserId, [{ variantId, quantity: 1 }])
      const addressA = h.seedUserAddress(userId, 1)
      const addressB = h.seedUserAddress(otherUserId, 2)

      const results = await Promise.allSettled([
        h.createOrder.execute({ userId, addressId: addressA }),
        h.createOrder.execute({ userId: otherUserId, addressId: addressB }),
      ])

      const fulfilled = results.filter((r) => r.status === 'fulfilled')
      const rejected = results.filter((r) => r.status === 'rejected')

      expect(fulfilled).toHaveLength(1)
      expect(rejected).toHaveLength(1)
      expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(
        InsufficientStockForOrderError
      )

      const level = h.inventory.snapshot(variantId)[0]
      expect(level.onHand).toBe(1)
      expect(level.reserved).toBe(1)
      expect(h.inventory.available(variantId)).toBe(0)
    })
  })

  describe('Cancel', () => {
    it('cancels a pending order and rejects a second cancel', async () => {
      const { h, addressId } = readyCheckout(5, 1)
      const order = await h.createOrder.execute({ userId, addressId })

      const cancelled = await h.cancelOrder.execute({ orderId: order.id, userId })
      expect(cancelled.status).toBe(OrderStatus.Cancelled)
      expect(h.inventory.available(variantId)).toBe(5)

      await expect(
        h.cancelOrder.execute({ orderId: order.id, userId })
      ).rejects.toBeInstanceOf(OrderNotCancellableError)
    })

    it('rejects cancel for another customer order', async () => {
      const { h, addressId } = readyCheckout(5, 1)
      const order = await h.createOrder.execute({ userId, addressId })

      await expect(
        h.cancelOrder.execute({ orderId: order.id, userId: otherUserId })
      ).rejects.toBeInstanceOf(OrderNotOwnedError)
    })
  })

  describe('Payment initiate + callback idempotency', () => {
    async function onlineOrder() {
      const { h, addressId } = readyCheckout(5, 2)
      const order = await h.createOrder.execute({
        userId,
        addressId,
        paymentMethod: PaymentMethod.Online,
      })
      return { h, order }
    }

    it('requires ONLINE pending ownership to initiate', async () => {
      const { h, addressId } = readyCheckout(5, 1)
      const cod = await h.createOrder.execute({
        userId,
        addressId,
        paymentMethod: PaymentMethod.CashOnDelivery,
      })

      await expect(
        h.initiatePayment.execute({
          orderId: cod.id,
          userId,
          idempotencyKey: 'cod-1',
        })
      ).rejects.toBeInstanceOf(OrderNotPayableError)
    })

    it('returns the same payment for a repeated Idempotency-Key', async () => {
      const { h, order } = await onlineOrder()

      const first = await h.initiatePayment.execute({
        orderId: order.id,
        userId,
        idempotencyKey: 'checkout-1',
      })
      const second = await h.initiatePayment.execute({
        orderId: order.id,
        userId,
        idempotencyKey: 'checkout-1',
      })

      expect(second.id).toBe(first.id)
      expect(second.gatewayRef).toBe(first.gatewayRef)
      expect(second.redirectUrl).toBe(first.redirectUrl)
      expect(first.status).toBe(PaymentStatus.Initiated)
    })

    it('conflicts when the same key is reused for a different order', async () => {
      const { h, order } = await onlineOrder()
      await h.initiatePayment.execute({
        orderId: order.id,
        userId,
        idempotencyKey: 'shared-key',
      })

      h.seedUserBasket(userId, [{ variantId, quantity: 1 }])
      const addressId = h.seedUserAddress(userId)
      const other = await h.createOrder.execute({
        userId,
        addressId,
        paymentMethod: PaymentMethod.Online,
      })

      await expect(
        h.initiatePayment.execute({
          orderId: other.id,
          userId,
          idempotencyKey: 'shared-key',
        })
      ).rejects.toBeInstanceOf(IdempotencyConflictError)
    })

    it('marks order PAID, consumes stock, and is idempotent on callback replay', async () => {
      const { h, order } = await onlineOrder()
      const payment = await h.initiatePayment.execute({
        orderId: order.id,
        userId,
        idempotencyKey: 'pay-ok',
      })

      const first = await h.handleCallback.execute({
        raw: h.successCallbackRaw(payment.gatewayRef!),
      })

      expect(first.order.status).toBe(OrderStatus.Paid)
      expect(first.payment.status).toBe(PaymentStatus.Succeeded)
      expect(h.orders.byId.get(order.id)?.reservationStatus).toBe(
        OrderReservationStatus.Consumed
      )
      expect(h.inventory.snapshot(variantId)[0]).toMatchObject({ onHand: 3, reserved: 0 })

      const replay = await h.handleCallback.execute({
        raw: h.successCallbackRaw(payment.gatewayRef!),
      })

      expect(replay.order.status).toBe(OrderStatus.Paid)
      expect(h.inventory.snapshot(variantId)[0]).toMatchObject({ onHand: 3, reserved: 0 })
    })

    it('marks payment FAILED without releasing stock; the same key can retry', async () => {
      const { h, order } = await onlineOrder()
      const payment = await h.initiatePayment.execute({
        orderId: order.id,
        userId,
        idempotencyKey: 'pay-fail',
      })

      await h.handleCallback.execute({
        raw: h.failCallbackRaw(payment.gatewayRef!),
      })

      expect(h.orders.byId.get(order.id)?.status).toBe(OrderStatus.Pending)
      expect(h.inventory.snapshot(variantId)[0].reserved).toBe(2)

      const retry = await h.initiatePayment.execute({
        orderId: order.id,
        userId,
        idempotencyKey: 'pay-fail',
      })
      expect(retry.status).toBe(PaymentStatus.Initiated)
      expect(retry.id).toBe(payment.id)
      expect(retry.gatewayRef).not.toBe(payment.gatewayRef)
    })

    it('rejects an unknown trackId and a failed gateway verify', async () => {
      const { h, order } = await onlineOrder()

      await expect(
        h.handleCallback.execute({
          raw: h.successCallbackRaw('missing'),
        })
      ).rejects.toBeInstanceOf(PaymentNotFoundError)

      const payment = await h.initiatePayment.execute({
        orderId: order.id,
        userId,
        idempotencyKey: 'sec',
      })

      h.gateway.failNextVerify = true
      const failed = await h.handleCallback.execute({
        raw: h.successCallbackRaw(payment.gatewayRef!),
      })
      expect(failed.payment.status).toBe(PaymentStatus.Failed)
      expect(h.orders.byId.get(order.id)?.status).toBe(OrderStatus.Pending)
    })

    it('rejects a second Idempotency-Key while a payment is already in flight', async () => {
      const { h, order } = await onlineOrder()
      const first = await h.initiatePayment.execute({
        orderId: order.id,
        userId,
        idempotencyKey: 'pay-first',
      })
      expect(first.status).toBe(PaymentStatus.Initiated)

      await expect(
        h.initiatePayment.execute({
          orderId: order.id,
          userId,
          idempotencyKey: 'pay-second',
        })
      ).rejects.toBeInstanceOf(PaymentAlreadyInProgressError)
    })

    it('revives a cancelled ONLINE order when the gateway later confirms payment', async () => {
      const { h, order } = await onlineOrder()
      const payment = await h.initiatePayment.execute({
        orderId: order.id,
        userId,
        idempotencyKey: 'late-pay',
      })
      await h.cancelOrder.execute({ orderId: order.id, userId })
      expect(h.orders.byId.get(order.id)?.status).toBe(OrderStatus.Cancelled)
      expect(h.inventory.snapshot(variantId)[0].reserved).toBe(0)

      const result = await h.handleCallback.execute({
        raw: h.successCallbackRaw(payment.gatewayRef!),
      })

      expect(result.order.status).toBe(OrderStatus.Paid)
      expect(result.order.cancelledAt).toBeNull()
      expect(result.payment.status).toBe(PaymentStatus.Succeeded)
      expect(h.orders.byId.get(order.id)?.reservationStatus).toBe(
        OrderReservationStatus.Consumed
      )
      expect(h.inventory.snapshot(variantId)[0]).toMatchObject({ onHand: 3, reserved: 0 })
    })

    it('rejects cancel after a successful payment', async () => {
      const { h, order } = await onlineOrder()
      const payment = await h.initiatePayment.execute({
        orderId: order.id,
        userId,
        idempotencyKey: 'paid-then-cancel',
      })
      await h.handleCallback.execute({
        raw: h.successCallbackRaw(payment.gatewayRef!),
      })

      await expect(
        h.cancelOrder.execute({ orderId: order.id, userId })
      ).rejects.toBeInstanceOf(OrderNotCancellableError)
    })
  })

  describe('Ownership', () => {
    it('hides another customer order on get', async () => {
      const { h, addressId } = readyCheckout(5, 1)
      const order = await h.createOrder.execute({ userId, addressId })

      await expect(
        h.getOrder.execute({ orderId: order.id, userId: otherUserId })
      ).rejects.toBeInstanceOf(OrderNotOwnedError)
    })
  })

  describe('Fulfillment', () => {
    it('confirms COD, consumes stock, then completes delivery', async () => {
      const { h, addressId } = readyCheckout(10, 2)
      const order = await h.createOrder.execute({
        userId,
        addressId,
        paymentMethod: PaymentMethod.CashOnDelivery,
      })

      const paid = await h.confirmCod.execute({ orderId: order.id })
      expect(paid.status).toBe(OrderStatus.Paid)
      expect(h.inventory.snapshot(variantId)[0].onHand).toBe(8)
      expect(h.inventory.snapshot(variantId)[0].reserved).toBe(0)

      const completed = await h.completeOrder.execute({ orderId: order.id })
      expect(completed.status).toBe(OrderStatus.Completed)
      expect(completed.completedAt).toEqual(h.clock.now())
    })

    it('is idempotent when COD is already confirmed', async () => {
      const { h, addressId } = readyCheckout(5, 1)
      const order = await h.createOrder.execute({
        userId,
        addressId,
        paymentMethod: PaymentMethod.CashOnDelivery,
      })

      await h.confirmCod.execute({ orderId: order.id })
      const again = await h.confirmCod.execute({ orderId: order.id })

      expect(again.status).toBe(OrderStatus.Paid)
      expect(h.inventory.snapshot(variantId)[0].onHand).toBe(4)
    })

    it('rejects COD confirm on an ONLINE order', async () => {
      const { h, addressId } = readyCheckout(5, 1)
      const order = await h.createOrder.execute({
        userId,
        addressId,
        paymentMethod: PaymentMethod.Online,
      })

      await expect(h.confirmCod.execute({ orderId: order.id })).rejects.toBeInstanceOf(
        OrderNotPayableError
      )
      expect(h.inventory.snapshot(variantId)[0].reserved).toBe(1)
    })

    it('rejects completing a pending order', async () => {
      const { h, addressId } = readyCheckout(5, 1)
      const order = await h.createOrder.execute({ userId, addressId })

      await expect(h.completeOrder.execute({ orderId: order.id })).rejects.toBeInstanceOf(
        OrderNotCompletableError
      )
    })
  })

  describe('Unpaid ONLINE timeout (production 15 min, test delay 10s)', () => {
    it('schedules a 10s cancel job only for ONLINE checkout', async () => {
      const { h, addressId } = readyCheckout(5, 1)

      const online = await h.createOrder.execute({
        userId,
        addressId,
        paymentMethod: PaymentMethod.Online,
      })

      const job = h.paymentTimeouts.jobs.get(online.id)
      expect(job).toEqual({
        orderId: online.id,
        delayMs: TEST_UNPAID_CANCEL_DELAY_MS,
        dueAtMs: h.clock.now().getTime() + TEST_UNPAID_CANCEL_DELAY_MS,
      })

      h.seedUserBasket(userId, [{ variantId, quantity: 1 }])
      const cod = await h.createOrder.execute({
        userId,
        addressId,
        paymentMethod: PaymentMethod.CashOnDelivery,
      })
      expect(h.paymentTimeouts.jobs.has(cod.id)).toBe(false)
    })

    it('leaves an unpaid ONLINE order pending before the delay elapses', async () => {
      const { h, addressId } = readyCheckout(5, 1)
      const order = await h.createOrder.execute({
        userId,
        addressId,
        paymentMethod: PaymentMethod.Online,
      })

      h.clock.advanceMs(TEST_UNPAID_CANCEL_DELAY_MS - 1)
      await h.runDueUnpaidCancels()

      expect(h.orders.byId.get(order.id)?.status).toBe(OrderStatus.Pending)
      expect(h.inventory.snapshot(variantId)[0].reserved).toBe(1)
      expect(h.paymentTimeouts.jobs.has(order.id)).toBe(true)
    })

    it('cancels an unpaid ONLINE order and releases stock after 10s', async () => {
      const { h, addressId } = readyCheckout(5, 1)
      const order = await h.createOrder.execute({
        userId,
        addressId,
        paymentMethod: PaymentMethod.Online,
      })
      expect(h.inventory.available(variantId)).toBe(4)

      h.clock.advanceMs(TEST_UNPAID_CANCEL_DELAY_MS)
      await h.runDueUnpaidCancels()

      expect(h.orders.byId.get(order.id)?.status).toBe(OrderStatus.Cancelled)
      expect(h.inventory.snapshot(variantId)[0].reserved).toBe(0)
      expect(h.inventory.available(variantId)).toBe(5)
      expect(h.paymentTimeouts.jobs.has(order.id)).toBe(false)
    })

    it('does not cancel after timeout if the customer already paid', async () => {
      const { h, addressId } = readyCheckout(5, 1)
      const order = await h.createOrder.execute({
        userId,
        addressId,
        paymentMethod: PaymentMethod.Online,
      })
      const payment = await h.initiatePayment.execute({
        orderId: order.id,
        userId,
        idempotencyKey: 'pay-before-timeout',
      })
      await h.handleCallback.execute({
        raw: h.successCallbackRaw(payment.gatewayRef!),
      })
      expect(h.paymentTimeouts.jobs.has(order.id)).toBe(false)

      h.clock.advanceMs(TEST_UNPAID_CANCEL_DELAY_MS)
      await h.runDueUnpaidCancels()

      expect(h.orders.byId.get(order.id)?.status).toBe(OrderStatus.Paid)
      expect(h.inventory.snapshot(variantId)[0]).toMatchObject({ onHand: 4, reserved: 0 })
    })
  })

  describe('Checkout races and preview', () => {
    it('lets only one of two same-user checkouts succeed', async () => {
      const { h, addressId } = readyCheckout(10, 2)

      const results = await Promise.allSettled([
        h.createOrder.execute({ userId, addressId }),
        h.createOrder.execute({ userId, addressId }),
      ])

      const fulfilled = results.filter((r) => r.status === 'fulfilled')
      const rejected = results.filter((r) => r.status === 'rejected')

      expect(fulfilled).toHaveLength(1)
      expect(rejected).toHaveLength(1)
      expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(EmptyBasketError)
      expect(h.inventory.snapshot(variantId)[0].reserved).toBe(2)
    })

    it('previews totals without reserving stock or clearing the basket', async () => {
      const { h, addressId } = readyCheckout(10, 2)

      const preview = await h.previewCheckout.execute({
        userId,
        addressId,
        paymentMethod: PaymentMethod.Online,
        note: 'عصر',
      })

      expect(preview.subtotal).toBe(2_000_000)
      expect(preview.shippingFee).toBe(0)
      expect(preview.total).toBe(2_000_000)
      expect(preview.itemCount).toBe(2)
      expect(preview.paymentMethod).toBe(PaymentMethod.Online)
      expect(preview.note).toBe('عصر')
      expect(h.inventory.snapshot(variantId)[0].reserved).toBe(0)
      expect(await h.baskets.getByUserId(userId)).toMatchObject({
        items: [{ variantId, quantity: 2 }],
      })
    })

    it('pays an order even when the gateway receipt amount mismatches', async () => {
      const { h, addressId } = readyCheckout(5, 2)
      const order = await h.createOrder.execute({
        userId,
        addressId,
        paymentMethod: PaymentMethod.Online,
      })
      const payment = await h.initiatePayment.execute({
        orderId: order.id,
        userId,
        idempotencyKey: 'mismatch',
      })
      h.gateway.paidAmountByRef.set(payment.gatewayRef!, payment.amount + 1)

      const result = await h.handleCallback.execute({
        raw: h.successCallbackRaw(payment.gatewayRef!),
      })

      expect(result.order.status).toBe(OrderStatus.Paid)
      expect(result.payment.status).toBe(PaymentStatus.Succeeded)
      expect(h.inventory.snapshot(variantId)[0]).toMatchObject({ onHand: 3, reserved: 0 })
    })

    it('cancels and releases stock when unpaid-timeout enqueue fails after commit', async () => {
      const { h, addressId } = readyCheckout(5, 1)
      h.paymentTimeouts.failNextSchedule = true

      await expect(
        h.createOrder.execute({
          userId,
          addressId,
          paymentMethod: PaymentMethod.Online,
        })
      ).rejects.toThrow('queue unavailable')

      const leftover = [...h.orders.byId.values()]
      expect(leftover).toHaveLength(1)
      expect(leftover[0].status).toBe(OrderStatus.Cancelled)
      expect(h.inventory.snapshot(variantId)[0].reserved).toBe(0)
      expect(h.inventory.available(variantId)).toBe(5)
    })

    it('does not consume stock twice when pay and cancel race', async () => {
      const { h, addressId } = readyCheckout(5, 2)
      const order = await h.createOrder.execute({
        userId,
        addressId,
        paymentMethod: PaymentMethod.Online,
      })
      const payment = await h.initiatePayment.execute({
        orderId: order.id,
        userId,
        idempotencyKey: 'race-pay-cancel',
      })

      const results = await Promise.allSettled([
        h.handleCallback.execute({ raw: h.successCallbackRaw(payment.gatewayRef!) }),
        h.cancelOrder.execute({ orderId: order.id, userId }),
      ])

      const statuses = results.map((r) => r.status)
      expect(statuses.filter((s) => s === 'fulfilled').length).toBeGreaterThanOrEqual(1)

      const persisted = h.orders.byId.get(order.id)!
      const level = h.inventory.snapshot(variantId)[0]
      if (persisted.status === OrderStatus.Paid) {
        expect(level).toMatchObject({ onHand: 3, reserved: 0 })
        expect(persisted.reservationStatus).toBe(OrderReservationStatus.Consumed)
      } else {
        expect(persisted.status).toBe(OrderStatus.Cancelled)
        expect(level).toMatchObject({ onHand: 5, reserved: 0 })
      }
    })
  })
})
