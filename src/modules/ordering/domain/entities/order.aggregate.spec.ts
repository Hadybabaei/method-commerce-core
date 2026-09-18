import { Order } from './order.aggregate'
import { OrderItem } from './order-item.entity'
import { OrderReservationStatus, OrderStatus, PaymentMethod } from '../enums/order.enums'
import { OrderNotCancellableError, OrderNotCompletableError, OrderNotPayableError } from '../errors/ordering.errors'
import { Money } from '@shared/domain/value-objects/money'
import { StockAllocationPlan } from '../value-objects/stock-allocation.vo'

const address = {
  id: 1,
  title: 'خانه',
  province: { id: 1, name: 'تهران', slug: 'tehran', telPrefix: '021' },
  city: { id: 1, name: 'تهران', slug: 'tehran', provinceId: 1 },
  hood: 'نیاوران',
  postalCode: '1234567890',
  pelak: '12',
  vahed: '3',
  details: 'پلاک ۱۲',
  receiver: { isAccountOwner: true, fullName: null, phoneNumber: null },
  location: null,
}

function buildOrder(): Order {
  const item = OrderItem.create({
    variantId: 11,
    quantity: 2,
    unitPrice: Money.fromMinor(1_000_000),
    snapshot: {
      productId: 1,
      variantId: 11,
      title: 'Drill',
      slug: 'drill',
      sku: 'DRL-1',
      options: [],
      image: null,
      thumbnail: null,
    },
  })

  return Order.create({
    number: 'ORD-TEST-1',
    userId: 4,
    paymentMethod: PaymentMethod.CashOnDelivery,
    items: [item],
    addressSnapshot: address,
  })
}

describe('Order', () => {
  it('starts pending with a computed subtotal', () => {
    const order = buildOrder()
    expect(order.status).toBe(OrderStatus.Pending)
    expect(order.subtotal.amount).toBe(2_000_000)
    expect(order.itemCount).toBe(2)
    expect(order.canCancel).toBe(true)
  })

  it('cancels a pending order and marks reservation released', () => {
    const order = buildOrder()
    order.markReserved(StockAllocationPlan.of([{ variantId: 11, locationId: 1, quantity: 2 }]))
    order.cancel()

    expect(order.status).toBe(OrderStatus.Cancelled)
    expect(order.cancelledAt).not.toBeNull()
    expect(order.reservationStatus).toBe(OrderReservationStatus.Released)
  })

  it('revives a cancelled online order so a late payment can capture', () => {
    const item = OrderItem.create({
      variantId: 11,
      quantity: 2,
      unitPrice: Money.fromMinor(1_000_000),
      snapshot: {
        productId: 1,
        variantId: 11,
        title: 'Drill',
        slug: 'drill',
        sku: 'DRL-1',
        options: [],
        image: null,
        thumbnail: null,
      },
    })
    const order = Order.create({
      number: 'ORD-TEST-REVIVE',
      userId: 4,
      paymentMethod: PaymentMethod.Online,
      items: [item],
      addressSnapshot: address,
    })
    order.markReserved(StockAllocationPlan.of([{ variantId: 11, locationId: 1, quantity: 2 }]))
    order.cancel()

    const plan = StockAllocationPlan.of([{ variantId: 11, locationId: 1, quantity: 2 }])
    order.reviveForPayment(plan)
    const now = new Date('2026-09-17T12:30:00.000Z')
    order.markPaid(now)

    expect(order.status).toBe(OrderStatus.Paid)
    expect(order.cancelledAt).toBeNull()
    expect(order.paidAt).toEqual(now)
    expect(order.reservationStatus).toBe(OrderReservationStatus.Consumed)
  })

  it('rejects reviving a pending or COD order', () => {
    const pending = buildOrder()
    pending.markReserved(StockAllocationPlan.of([{ variantId: 11, locationId: 1, quantity: 2 }]))
    expect(() =>
      pending.reviveForPayment(StockAllocationPlan.of([{ variantId: 11, locationId: 1, quantity: 2 }]))
    ).toThrow(OrderNotPayableError)

    const cod = buildOrder()
    cod.markReserved(StockAllocationPlan.of([{ variantId: 11, locationId: 1, quantity: 2 }]))
    cod.cancel()
    expect(() =>
      cod.reviveForPayment(StockAllocationPlan.of([{ variantId: 11, locationId: 1, quantity: 2 }]))
    ).toThrow(OrderNotPayableError)
  })

  it('rejects cancelling a non-pending order', () => {
    const order = Order.fromPersistence(1, {
      number: 'ORD-TEST-2',
      userId: 4,
      status: OrderStatus.Paid,
      reservationStatus: OrderReservationStatus.Consumed,
      paymentMethod: PaymentMethod.CashOnDelivery,
      items: [],
      addressSnapshot: address,
      note: null,
      stockAllocations: StockAllocationPlan.empty(),
      cancelledAt: null,
      paidAt: new Date(),
      completedAt: null,
      createdAt: new Date(),
    })

    expect(() => order.cancel()).toThrow(OrderNotCancellableError)
  })

  it('marks an online reserved order as paid and consumed', () => {
    const item = OrderItem.create({
      variantId: 11,
      quantity: 2,
      unitPrice: Money.fromMinor(1_000_000),
      snapshot: {
        productId: 1,
        variantId: 11,
        title: 'Drill',
        slug: 'drill',
        sku: 'DRL-1',
        options: [],
        image: null,
        thumbnail: null,
      },
    })

    const order = Order.create({
      number: 'ORD-TEST-PAY',
      userId: 4,
      paymentMethod: PaymentMethod.Online,
      items: [item],
      addressSnapshot: address,
    })
    order.markReserved(StockAllocationPlan.of([{ variantId: 11, locationId: 1, quantity: 2 }]))

    const now = new Date('2026-09-17T12:00:00.000Z')
    order.markPaid(now)

    expect(order.status).toBe(OrderStatus.Paid)
    expect(order.paidAt).toEqual(now)
    expect(order.reservationStatus).toBe(OrderReservationStatus.Consumed)
    expect(order.canCancel).toBe(false)
  })

  it('confirms a reserved COD order as paid and consumed', () => {
    const order = buildOrder()
    order.markReserved(StockAllocationPlan.of([{ variantId: 11, locationId: 1, quantity: 2 }]))

    const now = new Date('2026-09-17T12:00:00.000Z')
    order.confirmCashOnDelivery(now)

    expect(order.status).toBe(OrderStatus.Paid)
    expect(order.paidAt).toEqual(now)
    expect(order.reservationStatus).toBe(OrderReservationStatus.Consumed)
  })

  it('rejects COD confirm on an online order', () => {
    const item = OrderItem.create({
      variantId: 11,
      quantity: 2,
      unitPrice: Money.fromMinor(1_000_000),
      snapshot: {
        productId: 1,
        variantId: 11,
        title: 'Drill',
        slug: 'drill',
        sku: 'DRL-1',
        options: [],
        image: null,
        thumbnail: null,
      },
    })
    const order = Order.create({
      number: 'ORD-TEST-ONLINE',
      userId: 4,
      paymentMethod: PaymentMethod.Online,
      items: [item],
      addressSnapshot: address,
    })
    order.markReserved(StockAllocationPlan.of([{ variantId: 11, locationId: 1, quantity: 2 }]))

    expect(() => order.confirmCashOnDelivery(new Date())).toThrow(OrderNotPayableError)
  })

  it('completes a paid order', () => {
    const order = buildOrder()
    order.markReserved(StockAllocationPlan.of([{ variantId: 11, locationId: 1, quantity: 2 }]))
    order.confirmCashOnDelivery(new Date('2026-09-17T12:00:00.000Z'))

    const delivered = new Date('2026-09-17T18:00:00.000Z')
    order.complete(delivered)

    expect(order.status).toBe(OrderStatus.Completed)
    expect(order.completedAt).toEqual(delivered)
  })

  it('rejects completing a pending order', () => {
    const order = buildOrder()
    expect(() => order.complete(new Date())).toThrow(OrderNotCompletableError)
  })
})
