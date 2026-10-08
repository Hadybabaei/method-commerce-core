import { UNSAVED_ID } from '@shared/domain/identifier'
import { Money } from '@shared/domain/value-objects/money'
import { ReturnRequestStatus } from '../enums/order.enums'
import { InvalidRefundError, RefundNotAllowedError } from '../errors/ordering.errors'
import { Order } from './order.aggregate'
import { ReturnRequest } from './return-request.aggregate'

const REFERENCE_MAX = 100
const NOTE_MAX = 1000
/** Clock skew allowed for a paid-at time typed by an admin. */
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000

export interface RefundProps {
  orderId: number
  returnRequestId: number | null
  amount: Money
  restocked: boolean
  /** Bank transfer reference. */
  reference: string
  note: string | null
  paidAt: Date
  adminId: number | null
  createdAt: Date
}

export interface RecordRefundInput {
  order: Order
  amount: number
  reference: string
  paidAt: Date
  note?: string | null
  adminId: number | null
  /** An approved return this refund settles; it becomes REFUNDED. */
  returnRequest?: ReturnRequest | null
  /** Put the returned units back on hand. Needs a return request. */
  restock?: boolean
  now: Date
}

/**
 * Money paid back by bank transfer outside the system. Recording it raises
 * the order's refunded total, which can never pass the amount paid.
 */
export class Refund {
  private constructor(
    readonly id: number,
    private readonly props: RefundProps
  ) {}

  static record(input: RecordRefundInput): Refund {
    const { order, returnRequest } = input

    if (!order.paidAt) {
      throw new RefundNotAllowedError('Only paid orders can be refunded', { status: order.status })
    }

    if (!Number.isInteger(input.amount) || input.amount < 1) {
      throw new InvalidRefundError('Refund amount must be a whole number of Rial above 0', {
        amount: input.amount,
      })
    }
    const amount = Money.fromMinor(input.amount)
    const refundable = order.total.amount - order.refundedTotal.amount
    if (input.amount > refundable) {
      throw new RefundNotAllowedError('Refunds cannot exceed what the customer paid', {
        amount: input.amount,
        refundable,
      })
    }

    const reference = input.reference.trim()
    if (!reference || reference.length > REFERENCE_MAX) {
      throw new InvalidRefundError(`Transfer reference must be 1 to ${REFERENCE_MAX} characters`)
    }
    const note = input.note?.trim() || null
    if (note && note.length > NOTE_MAX) {
      throw new InvalidRefundError(`Note must be at most ${NOTE_MAX} characters`)
    }
    if (input.paidAt.getTime() > input.now.getTime() + FUTURE_TOLERANCE_MS) {
      throw new InvalidRefundError('Paid-at cannot be in the future')
    }

    if (returnRequest) {
      if (returnRequest.orderId !== order.id) {
        throw new RefundNotAllowedError('The return request belongs to another order', {
          returnRequest: returnRequest.id,
        })
      }
      if (returnRequest.status !== ReturnRequestStatus.Approved) {
        throw new RefundNotAllowedError('Only an approved return can be refunded', {
          status: returnRequest.status,
        })
      }
    }
    if (input.restock && !returnRequest) {
      throw new InvalidRefundError('Restocking needs the return request it belongs to')
    }

    order.recordRefund(amount)
    returnRequest?.markRefunded()

    return new Refund(UNSAVED_ID, {
      orderId: order.id,
      returnRequestId: returnRequest?.id ?? null,
      amount,
      restocked: Boolean(input.restock),
      reference,
      note,
      paidAt: input.paidAt,
      adminId: input.adminId,
      createdAt: input.now,
    })
  }

  static fromPersistence(id: number, props: RefundProps): Refund {
    return new Refund(id, props)
  }

  get orderId(): number {
    return this.props.orderId
  }

  get returnRequestId(): number | null {
    return this.props.returnRequestId
  }

  get amount(): Money {
    return this.props.amount
  }

  get restocked(): boolean {
    return this.props.restocked
  }

  get reference(): string {
    return this.props.reference
  }

  get note(): string | null {
    return this.props.note
  }

  get paidAt(): Date {
    return this.props.paidAt
  }

  get adminId(): number | null {
    return this.props.adminId
  }

  get createdAt(): Date {
    return this.props.createdAt
  }
}
