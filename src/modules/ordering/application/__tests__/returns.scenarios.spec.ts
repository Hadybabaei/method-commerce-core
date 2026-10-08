import { InvalidInputError } from '@shared/domain/errors'
import { ReturnRequestStatus } from '../../domain/enums/order.enums'
import {
  InvalidRefundError,
  InvalidReturnRequestError,
  OrderNotOwnedError,
  RefundNotAllowedError,
  ReturnAlreadyDecidedError,
  ReturnNotAllowedError,
} from '../../domain/errors/ordering.errors'
import { createCommerceHarness, defaultVariant, phoneFor } from './commerce-scenarios.support'

const DAY_MS = 24 * 60 * 60 * 1000

describe('Returns and refunds', () => {
  const userId = 1

  /** A delivered COD order: 2 × variant 11 (1,000,000) + 1 × variant 12 (500,000), 10% VAT. */
  async function deliveredOrder() {
    const h = createCommerceHarness()
    h.storeSettings.current.vatRateBp = 1000
    h.seedCatalogVariant(defaultVariant(11))
    h.seedCatalogVariant(defaultVariant(12, { unitPrice: 500_000 }))
    h.seedStock(11, 5)
    h.seedStock(12, 5)
    h.seedUserBasket(userId, [
      { variantId: 11, quantity: 2 },
      { variantId: 12, quantity: 1 },
    ])
    const addressId = h.seedUserAddress(userId)
    const placed = await h.createOrder.execute({ userId, addressId })
    await h.confirmCod.execute({ orderId: placed.id })
    const order = await h.completeOrder.execute({ orderId: placed.id })
    const [drill, tape] = order.items
    return { h, order, drill, tape }
  }

  describe('requesting a return', () => {
    it('records the lines and reason and shows the deadline', async () => {
      const { h, order, drill } = await deliveredOrder()

      const view = await h.requestReturn.execute({
        orderId: order.id,
        userId,
        items: [{ orderItemId: drill.id, quantity: 1 }],
        reason: 'سایز مناسب نبود',
      })

      expect(view.returns).toEqual([
        expect.objectContaining({
          status: ReturnRequestStatus.Requested,
          reason: 'سایز مناسب نبود',
          items: [expect.objectContaining({ orderItemId: drill.id, quantity: 1, title: 'Drill' })],
        }),
      ])
      expect(view.returnableUntil?.getTime()).toBe(h.clock.now().getTime() + 7 * DAY_MS)
    })

    it('refuses orders that are not delivered yet', async () => {
      const h = createCommerceHarness()
      h.seedCatalogVariant(defaultVariant(11))
      h.seedStock(11, 5)
      h.seedUserBasket(userId, [{ variantId: 11, quantity: 1 }])
      const order = await h.createOrder.execute({ userId, addressId: h.seedUserAddress(userId) })

      await expect(
        h.requestReturn.execute({
          orderId: order.id,
          userId,
          items: [{ orderItemId: order.items[0].id, quantity: 1 }],
          reason: 'دیگر لازم ندارم',
        })
      ).rejects.toBeInstanceOf(ReturnNotAllowedError)
    })

    it('refuses once the return window has closed', async () => {
      const { h, order, drill } = await deliveredOrder()
      h.clock.advanceMs(7 * DAY_MS + 1)

      await expect(
        h.requestReturn.execute({
          orderId: order.id,
          userId,
          items: [{ orderItemId: drill.id, quantity: 1 }],
          reason: 'دیر شد',
        })
      ).rejects.toBeInstanceOf(ReturnNotAllowedError)
    })

    it('never lets requests cover more units than were bought', async () => {
      const { h, order, drill } = await deliveredOrder()
      const ask = (quantity: number) =>
        h.requestReturn.execute({
          orderId: order.id,
          userId,
          items: [{ orderItemId: drill.id, quantity }],
          reason: 'معیوب است',
        })

      await expect(ask(3)).rejects.toBeInstanceOf(InvalidReturnRequestError)
      await ask(1)
      await ask(1)
      await expect(ask(1)).rejects.toBeInstanceOf(InvalidReturnRequestError)
    })

    it('frees the units of a rejected request', async () => {
      const { h, order, drill } = await deliveredOrder()
      const first = await h.requestReturn.execute({
        orderId: order.id,
        userId,
        items: [{ orderItemId: drill.id, quantity: 2 }],
        reason: 'معیوب است',
      })
      await h.decideReturn.execute({
        returnRequestId: first.returns[0].id,
        decision: 'reject',
        note: 'آسیب از مشتری',
      })

      await expect(
        h.requestReturn.execute({
          orderId: order.id,
          userId,
          items: [{ orderItemId: drill.id, quantity: 2 }],
          reason: 'دوباره درخواست می‌دهم',
        })
      ).resolves.toBeDefined()
    })

    it.each([
      ['another customer', { userId: 2 }, OrderNotOwnedError],
      [
        'a line from another order',
        { items: [{ orderItemId: 999, quantity: 1 }] },
        InvalidReturnRequestError,
      ],
      ['no items', { items: [] }, InvalidReturnRequestError],
      ['a two-letter reason', { reason: 'نه' }, InvalidReturnRequestError],
    ])('rejects %s', async (_, override, error) => {
      const { h, order, drill } = await deliveredOrder()
      await expect(
        h.requestReturn.execute({
          orderId: order.id,
          userId,
          items: [{ orderItemId: drill.id, quantity: 1 }],
          reason: 'معیوب است',
          ...override,
        })
      ).rejects.toBeInstanceOf(error)
    })
  })

  describe('deciding', () => {
    it('approves once, texts the customer, and lists requests by status', async () => {
      const { h, order, tape } = await deliveredOrder()
      const requested = await h.requestReturn.execute({
        orderId: order.id,
        userId,
        items: [{ orderItemId: tape.id, quantity: 1 }],
        reason: 'رنگ متفاوت بود',
      })
      const id = requested.returns[0].id

      expect((await h.listReturns.execute({ status: ReturnRequestStatus.Requested })).total).toBe(1)
      const approved = await h.decideReturn.execute({ returnRequestId: id, decision: 'approve' })

      expect(approved.returns[0].status).toBe(ReturnRequestStatus.Approved)
      expect(h.sms.sent.at(-1)).toMatchObject({
        phoneNumber: phoneFor(userId),
        text: expect.stringContaining('تأیید شد'),
      })
      expect((await h.listReturns.execute({ status: ReturnRequestStatus.Requested })).total).toBe(0)
      await expect(
        h.decideReturn.execute({ returnRequestId: id, decision: 'reject', note: 'x' })
      ).rejects.toBeInstanceOf(ReturnAlreadyDecidedError)
    })

    it('needs a reason to reject', async () => {
      const { h, order, tape } = await deliveredOrder()
      const requested = await h.requestReturn.execute({
        orderId: order.id,
        userId,
        items: [{ orderItemId: tape.id, quantity: 1 }],
        reason: 'رنگ متفاوت بود',
      })

      await expect(
        h.decideReturn.execute({ returnRequestId: requested.returns[0].id, decision: 'reject' })
      ).rejects.toBeInstanceOf(InvalidInputError)
    })
  })

  describe('refunds', () => {
    async function approvedReturn(quantity = 1) {
      const setup = await deliveredOrder()
      const { h, order, drill } = setup
      const requested = await h.requestReturn.execute({
        orderId: order.id,
        userId,
        items: [{ orderItemId: drill.id, quantity }],
        reason: 'معیوب است',
      })
      const returnRequestId = requested.returns[0].id
      await h.decideReturn.execute({ returnRequestId, decision: 'approve' })
      return { ...setup, returnRequestId }
    }

    it('settles an approved return, restocks it, and texts the transfer reference', async () => {
      const { h, order, returnRequestId } = await approvedReturn(1)
      const onHandBefore = h.inventory.snapshot(11)[0].onHand

      const view = await h.recordRefund.execute({
        orderId: order.id,
        adminId: 1,
        amount: 1_100_000, // 1,000,000 + 10% VAT
        reference: '140210081234',
        returnRequestId,
        restock: true,
      })

      expect(view.refundedTotal).toBe(1_100_000)
      expect(view.refunds).toEqual([
        expect.objectContaining({ amount: 1_100_000, reference: '140210081234', restocked: true }),
      ])
      expect(view.returns[0].status).toBe(ReturnRequestStatus.Refunded)
      expect(h.inventory.snapshot(11)[0].onHand).toBe(onHandBefore + 1)
      expect(h.sms.sent.at(-1)?.text).toContain('شماره پیگیری: 140210081234')
    })

    it('allows partial refunds but never more than the customer paid', async () => {
      const { h, order } = await deliveredOrder()
      // total = 2,500,000 + 250,000 VAT
      expect(order.total).toBe(2_750_000)

      await h.recordRefund.execute({
        orderId: order.id,
        adminId: 1,
        amount: 2_000_000,
        reference: 'A',
      })
      await expect(
        h.recordRefund.execute({ orderId: order.id, adminId: 1, amount: 750_001, reference: 'B' })
      ).rejects.toBeInstanceOf(RefundNotAllowedError)
      const view = await h.recordRefund.execute({
        orderId: order.id,
        adminId: 1,
        amount: 750_000,
        reference: 'B',
      })

      expect(view.refundedTotal).toBe(2_750_000)
      expect(view.refunds).toHaveLength(2)
    })

    it('refuses unpaid orders, unapproved returns and restocking without a return', async () => {
      const { h, order, drill } = await deliveredOrder()
      const requested = await h.requestReturn.execute({
        orderId: order.id,
        userId,
        items: [{ orderItemId: drill.id, quantity: 1 }],
        reason: 'معیوب است',
      })

      await expect(
        h.recordRefund.execute({
          orderId: order.id,
          adminId: 1,
          amount: 1000,
          reference: 'X',
          returnRequestId: requested.returns[0].id,
        })
      ).rejects.toBeInstanceOf(RefundNotAllowedError)
      await expect(
        h.recordRefund.execute({
          orderId: order.id,
          adminId: 1,
          amount: 1000,
          reference: 'X',
          restock: true,
        })
      ).rejects.toBeInstanceOf(InvalidRefundError)
      await expect(
        h.recordRefund.execute({ orderId: order.id, adminId: 1, amount: 1000, reference: '  ' })
      ).rejects.toBeInstanceOf(InvalidRefundError)

      const unpaid = createCommerceHarness()
      unpaid.seedCatalogVariant(defaultVariant(11))
      unpaid.seedStock(11, 5)
      unpaid.seedUserBasket(userId, [{ variantId: 11, quantity: 1 }])
      const pending = await unpaid.createOrder.execute({
        userId,
        addressId: unpaid.seedUserAddress(userId),
      })
      await expect(
        unpaid.recordRefund.execute({
          orderId: pending.id,
          adminId: 1,
          amount: 1000,
          reference: 'X',
        })
      ).rejects.toBeInstanceOf(RefundNotAllowedError)
    })
  })
})
