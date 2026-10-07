import { AggregateRoot } from '@shared/domain/aggregate-root.base'
import { Money } from '@shared/domain/value-objects/money'
import { UNSAVED_ID } from '@shared/domain/identifier'
import {
  EmptyBasketError,
  OrderNotCancellableError,
  OrderNotCompletableError,
  OrderNotOwnedError,
  OrderNotPayableError,
  OrderNotProcessableError,
  OrderNotShippableError,
  InvalidOrderNoteError,
  InvalidTrackingCodeError,
} from '../errors/ordering.errors'
import { OrderReservationStatus, OrderStatus, PaymentMethod } from '../enums/order.enums'
import { OrderItem } from './order-item.entity'
import { ShippingSnapshot } from './shipping-method.entity'
import { StockAllocationPlan } from '../value-objects/stock-allocation.vo'

const MAX_TRACKING_CODE_LENGTH = 100

/** How the order is delivered; `method` is null when the store had none configured. */
export interface OrderShipping {
  method: ShippingSnapshot | null
  fee: Money
  weightGrams: number
}

/** A status change not yet written to the history table. */
export interface OrderStatusChange {
  from: OrderStatus | null
  to: OrderStatus
  at: Date
  note: string | null
}

export interface AddressSnapshot {
  id: number
  title: string
  province: { id: number; name: string; slug: string; telPrefix: string }
  city: { id: number; name: string; slug: string; provinceId: number }
  hood: string
  postalCode: string
  pelak: string
  vahed: string | null
  details: string
  receiver: {
    isAccountOwner: boolean
    fullName: string | null
    phoneNumber: string | null
  }
  location: { latitude: number; longitude: number } | null
}

export interface OrderProps {
  number: string
  userId: number
  status: OrderStatus
  reservationStatus: OrderReservationStatus
  paymentMethod: PaymentMethod
  items: OrderItem[]
  addressSnapshot: AddressSnapshot
  note: string | null
  stockAllocations: StockAllocationPlan
  shipping: OrderShipping
  trackingCode: string | null
  trackingUrl: string | null
  cancelledAt: Date | null
  paidAt: Date | null
  processingAt: Date | null
  shippedAt: Date | null
  completedAt: Date | null
  createdAt: Date
}

export interface CreateOrderInput {
  number: string
  userId: number
  paymentMethod: PaymentMethod
  items: OrderItem[]
  addressSnapshot: AddressSnapshot
  shipping?: OrderShipping
  note?: string | null
}

const NO_SHIPPING: OrderShipping = { method: null, fee: Money.zero, weightGrams: 0 }

/**
 * A customer's checkout. Lines and the delivery address are frozen at create
 * time; stock is reserved until the order is paid or cancelled.
 */
export class Order extends AggregateRoot {
  private props: OrderProps
  private statusChanges: OrderStatusChange[] = []

  private constructor(id: number, props: OrderProps) {
    super(id)
    this.props = props
  }

  static create(input: CreateOrderInput): Order {
    if (input.items.length === 0) {
      throw new EmptyBasketError()
    }

    const note = Order.normalizeNote(input.note)
    const createdAt = new Date()

    const order = new Order(UNSAVED_ID, {
      number: input.number,
      userId: input.userId,
      status: OrderStatus.Pending,
      reservationStatus: OrderReservationStatus.None,
      paymentMethod: input.paymentMethod,
      items: input.items,
      addressSnapshot: input.addressSnapshot,
      note,
      stockAllocations: StockAllocationPlan.empty(),
      shipping: input.shipping ?? NO_SHIPPING,
      trackingCode: null,
      trackingUrl: null,
      cancelledAt: null,
      paidAt: null,
      processingAt: null,
      shippedAt: null,
      completedAt: null,
      createdAt,
    })
    order.statusChanges.push({ from: null, to: OrderStatus.Pending, at: createdAt, note: null })
    return order
  }

  static fromPersistence(id: number, props: OrderProps): Order {
    return new Order(id, props)
  }

  ensureOwnedBy(userId: number): void {
    if (this.props.userId !== userId) {
      throw new OrderNotOwnedError()
    }
  }

  /** Call after the inventory rows have been updated. */
  markReserved(plan: StockAllocationPlan): void {
    this.props.stockAllocations = plan
    this.props.reservationStatus = OrderReservationStatus.Reserved
  }

  /**
   * Reopens a cancelled ONLINE order after a late gateway capture so `markPaid`
   * can run. Caller must have re-reserved `plan` in the same transaction.
   */
  reviveForPayment(plan: StockAllocationPlan): void {
    if (this.props.status !== OrderStatus.Cancelled) {
      throw new OrderNotPayableError('Only a cancelled order can be revived for a late payment', {
        status: this.props.status,
      })
    }

    if (this.props.paymentMethod !== PaymentMethod.Online) {
      throw new OrderNotPayableError('Only online orders can be revived after cancel', {
        paymentMethod: this.props.paymentMethod,
      })
    }

    if (this.props.reservationStatus !== OrderReservationStatus.Released) {
      throw new OrderNotPayableError('Cancelled order stock is not released', {
        reservationStatus: this.props.reservationStatus,
      })
    }

    this.transitionTo(OrderStatus.Pending, new Date(), 'Revived by a late online payment')
    this.props.cancelledAt = null
    this.props.reservationStatus = OrderReservationStatus.None
    this.props.stockAllocations = StockAllocationPlan.empty()
    this.markReserved(plan)
  }

  cancel(): void {
    if (this.props.status !== OrderStatus.Pending) {
      throw new OrderNotCancellableError(this.props.status)
    }

    const now = new Date()
    this.transitionTo(OrderStatus.Cancelled, now)
    this.props.cancelledAt = now

    if (this.props.reservationStatus === OrderReservationStatus.Reserved) {
      this.props.reservationStatus = OrderReservationStatus.Released
    }
  }

  /**
   * Captures online payment. Stock must already be reserved; the caller then
   * consumes the allocation so units leave both `reserved` and `on_hand`.
   */
  markPaid(now: Date): void {
    if (this.props.status === OrderStatus.Paid) {
      return
    }

    if (this.props.status !== OrderStatus.Pending) {
      throw new OrderNotPayableError('Only a pending order can be paid', {
        status: this.props.status,
      })
    }

    if (this.props.reservationStatus !== OrderReservationStatus.Reserved) {
      throw new OrderNotPayableError('Order stock is not reserved', {
        reservationStatus: this.props.reservationStatus,
      })
    }

    if (this.props.paymentMethod !== PaymentMethod.Online) {
      throw new OrderNotPayableError('Only online orders accept a payment callback', {
        paymentMethod: this.props.paymentMethod,
      })
    }

    this.capturePayment(now)
  }

  /**
   * Operator confirms that cash-on-delivery will be (or has been) collected.
   * Stock must already be reserved; the caller then consumes the allocation.
   */
  confirmCashOnDelivery(now: Date): void {
    if (this.props.paymentMethod !== PaymentMethod.CashOnDelivery) {
      throw new OrderNotPayableError(
        'Only cash-on-delivery orders can be confirmed by an operator',
        { paymentMethod: this.props.paymentMethod }
      )
    }

    if (this.props.status === OrderStatus.Paid) {
      return
    }

    if (this.props.status !== OrderStatus.Pending) {
      throw new OrderNotPayableError('Only a pending order can be confirmed', {
        status: this.props.status,
      })
    }

    if (this.props.reservationStatus !== OrderReservationStatus.Reserved) {
      throw new OrderNotPayableError('Order stock is not reserved', {
        reservationStatus: this.props.reservationStatus,
      })
    }

    this.capturePayment(now)
  }

  /** Operator starts picking and packing a paid order. */
  startProcessing(now: Date): void {
    if (this.props.status === OrderStatus.Processing) {
      return
    }

    if (this.props.status !== OrderStatus.Paid) {
      throw new OrderNotProcessableError(this.props.status)
    }

    this.transitionTo(OrderStatus.Processing, now)
    this.props.processingAt = now
  }

  /**
   * Hands the parcel to the carrier. Re-shipping an already shipped order only
   * corrects the tracking details. Without an explicit URL, the method's
   * template builds one from the code.
   */
  ship(now: Date, input: { trackingCode?: string | null; trackingUrl?: string | null } = {}): void {
    const shippable = [OrderStatus.Paid, OrderStatus.Processing, OrderStatus.Shipped]
    if (!shippable.includes(this.props.status)) {
      throw new OrderNotShippableError(this.props.status)
    }

    const trackingCode = Order.normalizeTrackingCode(input.trackingCode)
    const template = this.props.shipping.method?.trackingUrlTemplate ?? null
    const trackingUrl =
      input.trackingUrl?.trim() ||
      (trackingCode && template
        ? template.replace('{code}', encodeURIComponent(trackingCode))
        : null)

    this.props.trackingCode = trackingCode
    this.props.trackingUrl = trackingUrl

    if (this.props.status === OrderStatus.Shipped) {
      return
    }

    if (this.props.processingAt === null) {
      this.props.processingAt = now
    }
    this.transitionTo(
      OrderStatus.Shipped,
      now,
      trackingCode ? `Tracking code ${trackingCode}` : null
    )
    this.props.shippedAt = now
  }

  /** Delivered to the customer. Paid orders may skip processing and shipping (e.g. pickup). */
  complete(now: Date): void {
    if (this.props.status === OrderStatus.Completed) {
      return
    }

    const completable = [OrderStatus.Paid, OrderStatus.Processing, OrderStatus.Shipped]
    if (!completable.includes(this.props.status)) {
      throw new OrderNotCompletableError(this.props.status)
    }

    this.transitionTo(OrderStatus.Completed, now)
    this.props.completedAt = now
  }

  /** Status changes since the last call, oldest first. The repository writes them to history. */
  pullStatusChanges(): OrderStatusChange[] {
    const changes = this.statusChanges
    this.statusChanges = []
    return changes
  }

  private transitionTo(to: OrderStatus, at: Date, note: string | null = null): void {
    this.statusChanges.push({ from: this.props.status, to, at, note })
    this.props.status = to
  }

  private capturePayment(now: Date): void {
    this.transitionTo(OrderStatus.Paid, now)
    this.props.paidAt = now
    this.props.reservationStatus = OrderReservationStatus.Consumed
  }

  /** True when a new payment attempt may be started. */
  get canInitiatePayment(): boolean {
    return (
      this.props.status === OrderStatus.Pending &&
      this.props.paymentMethod === PaymentMethod.Online &&
      this.props.reservationStatus === OrderReservationStatus.Reserved
    )
  }

  get number(): string {
    return this.props.number
  }

  get userId(): number {
    return this.props.userId
  }

  get status(): OrderStatus {
    return this.props.status
  }

  get reservationStatus(): OrderReservationStatus {
    return this.props.reservationStatus
  }

  get paymentMethod(): PaymentMethod {
    return this.props.paymentMethod
  }

  get items(): readonly OrderItem[] {
    return this.props.items
  }

  get addressSnapshot(): AddressSnapshot {
    return this.props.addressSnapshot
  }

  get note(): string | null {
    return this.props.note
  }

  get stockAllocations(): StockAllocationPlan {
    return this.props.stockAllocations
  }

  get cancelledAt(): Date | null {
    return this.props.cancelledAt
  }

  get paidAt(): Date | null {
    return this.props.paidAt
  }

  get processingAt(): Date | null {
    return this.props.processingAt
  }

  get shippedAt(): Date | null {
    return this.props.shippedAt
  }

  get completedAt(): Date | null {
    return this.props.completedAt
  }

  get shipping(): OrderShipping {
    return this.props.shipping
  }

  get trackingCode(): string | null {
    return this.props.trackingCode
  }

  get trackingUrl(): string | null {
    return this.props.trackingUrl
  }

  get createdAt(): Date {
    return this.props.createdAt
  }

  get itemCount(): number {
    return this.props.items.reduce((sum, item) => sum + item.quantity, 0)
  }

  get subtotal(): Money {
    return this.props.items.reduce((sum, item) => sum.add(item.lineTotal), Money.zero)
  }

  /** What the customer pays: subtotal plus shipping. */
  get total(): Money {
    return this.subtotal.add(this.props.shipping.fee)
  }

  get canCancel(): boolean {
    return this.props.status === OrderStatus.Pending
  }

  static normalizeTrackingCode(code: string | null | undefined): string | null {
    const trimmed = code?.trim()
    if (!trimmed) {
      return null
    }
    if (trimmed.length > MAX_TRACKING_CODE_LENGTH) {
      throw new InvalidTrackingCodeError()
    }
    return trimmed
  }

  static normalizeNote(note: string | null | undefined): string | null {
    if (note === undefined || note === null) {
      return null
    }
    const trimmed = note.trim()
    if (!trimmed) {
      return null
    }
    if (trimmed.length > 1000) {
      throw new InvalidOrderNoteError()
    }
    return trimmed
  }
}
