import { AggregateRoot } from '@shared/domain/aggregate-root.base'
import { Money } from '@shared/domain/value-objects/money'
import { UNSAVED_ID } from '@shared/domain/identifier'
import {
  EmptyBasketError,
  OrderNotCancellableError,
  OrderNotCompletableError,
  OrderNotOwnedError,
  OrderNotPayableError,
  InvalidOrderNoteError,
} from '../errors/ordering.errors'
import { OrderReservationStatus, OrderStatus, PaymentMethod } from '../enums/order.enums'
import { OrderItem } from './order-item.entity'
import { StockAllocationPlan } from '../value-objects/stock-allocation.vo'

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
  cancelledAt: Date | null
  paidAt: Date | null
  completedAt: Date | null
  createdAt: Date
}

export interface CreateOrderInput {
  number: string
  userId: number
  paymentMethod: PaymentMethod
  items: OrderItem[]
  addressSnapshot: AddressSnapshot
  note?: string | null
}

/**
 * A customer's checkout. Lines and the delivery address are frozen at create
 * time; stock is reserved until the order is paid or cancelled.
 */
export class Order extends AggregateRoot {
  private props: OrderProps

  private constructor(id: number, props: OrderProps) {
    super(id)
    this.props = props
  }

  static create(input: CreateOrderInput): Order {
    if (input.items.length === 0) {
      throw new EmptyBasketError()
    }

    const note = Order.normalizeNote(input.note)

    return new Order(UNSAVED_ID, {
      number: input.number,
      userId: input.userId,
      status: OrderStatus.Pending,
      reservationStatus: OrderReservationStatus.None,
      paymentMethod: input.paymentMethod,
      items: input.items,
      addressSnapshot: input.addressSnapshot,
      note,
      stockAllocations: StockAllocationPlan.empty(),
      cancelledAt: null,
      paidAt: null,
      completedAt: null,
      createdAt: new Date(),
    })
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

    this.props.status = OrderStatus.Pending
    this.props.cancelledAt = null
    this.props.reservationStatus = OrderReservationStatus.None
    this.props.stockAllocations = StockAllocationPlan.empty()
    this.markReserved(plan)
  }

  cancel(): void {
    if (this.props.status !== OrderStatus.Pending) {
      throw new OrderNotCancellableError(this.props.status)
    }

    this.props.status = OrderStatus.Cancelled
    this.props.cancelledAt = new Date()

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

  complete(now: Date): void {
    if (this.props.status === OrderStatus.Completed) {
      return
    }

    if (this.props.status !== OrderStatus.Paid) {
      throw new OrderNotCompletableError(this.props.status)
    }

    this.props.status = OrderStatus.Completed
    this.props.completedAt = now
  }

  private capturePayment(now: Date): void {
    this.props.status = OrderStatus.Paid
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

  get completedAt(): Date | null {
    return this.props.completedAt
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

  get canCancel(): boolean {
    return this.props.status === OrderStatus.Pending
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
