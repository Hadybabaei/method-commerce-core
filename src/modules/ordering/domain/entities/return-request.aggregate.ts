import { AggregateRoot } from '@shared/domain/aggregate-root.base'
import { UNSAVED_ID } from '@shared/domain/identifier'
import { OrderStatus, ReturnRequestStatus } from '../enums/order.enums'
import {
  InvalidReturnRequestError,
  ReturnAlreadyDecidedError,
  ReturnNotAllowedError,
} from '../errors/ordering.errors'
import { Order } from './order.aggregate'

const DAY_MS = 24 * 60 * 60 * 1000
const REASON_MIN = 3
const NOTE_MAX = 1000

export interface ReturnLine {
  orderItemId: number
  quantity: number
}

export interface ReturnRequestProps {
  orderId: number
  userId: number
  status: ReturnRequestStatus
  reason: string
  adminNote: string | null
  items: ReturnLine[]
  decidedAt: Date | null
  createdAt: Date
}

export interface RequestReturnInput {
  order: Order
  userId: number
  items: ReturnLine[]
  reason: string
  now: Date
  windowDays: number
  /** Units of each order line already covered by earlier, non-rejected requests. */
  alreadyRequested: ReadonlyMap<number, number>
}

/**
 * A customer's request to send back some lines of a delivered order. An admin
 * approves or rejects it; an approved request becomes REFUNDED once the money
 * goes back.
 */
export class ReturnRequest extends AggregateRoot {
  private props: ReturnRequestProps

  private constructor(id: number, props: ReturnRequestProps) {
    super(id)
    this.props = props
  }

  /** Earliest moment returns close for an order delivered at `completedAt`. */
  static windowEnd(completedAt: Date, windowDays: number): Date {
    return new Date(completedAt.getTime() + windowDays * DAY_MS)
  }

  static request(input: RequestReturnInput): ReturnRequest {
    const { order, now } = input
    order.ensureOwnedBy(input.userId)

    if (order.status !== OrderStatus.Completed || !order.completedAt) {
      throw new ReturnNotAllowedError('Only delivered orders can be returned', {
        status: order.status,
      })
    }
    if (now > ReturnRequest.windowEnd(order.completedAt, input.windowDays)) {
      throw new ReturnNotAllowedError('The return window for this order has closed', {
        windowDays: input.windowDays,
      })
    }

    const reason = input.reason.trim()
    if (reason.length < REASON_MIN || reason.length > NOTE_MAX) {
      throw new InvalidReturnRequestError(`Reason must be ${REASON_MIN} to ${NOTE_MAX} characters`)
    }

    if (input.items.length === 0) {
      throw new InvalidReturnRequestError('Choose at least one item to return')
    }
    const seen = new Set<number>()
    for (const line of input.items) {
      if (seen.has(line.orderItemId)) {
        throw new InvalidReturnRequestError('Each order line may appear once', {
          orderItemId: line.orderItemId,
        })
      }
      seen.add(line.orderItemId)

      const ordered = order.items.find((item) => item.id === line.orderItemId)
      if (!ordered) {
        throw new InvalidReturnRequestError('Item is not part of this order', {
          orderItemId: line.orderItemId,
        })
      }
      const remaining = ordered.quantity - (input.alreadyRequested.get(line.orderItemId) ?? 0)
      if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > remaining) {
        throw new InvalidReturnRequestError('Quantity exceeds what can still be returned', {
          orderItemId: line.orderItemId,
          requested: line.quantity,
          returnable: Math.max(0, remaining),
        })
      }
    }

    return new ReturnRequest(UNSAVED_ID, {
      orderId: order.id,
      userId: input.userId,
      status: ReturnRequestStatus.Requested,
      reason,
      adminNote: null,
      items: input.items.map((line) => ({ ...line })),
      decidedAt: null,
      createdAt: now,
    })
  }

  static fromPersistence(id: number, props: ReturnRequestProps): ReturnRequest {
    return new ReturnRequest(id, props)
  }

  approve(now: Date, note?: string | null): void {
    this.decide(ReturnRequestStatus.Approved, now, note)
  }

  reject(now: Date, note: string): void {
    if (!note?.trim()) {
      throw new InvalidReturnRequestError('Say why the return is rejected')
    }
    this.decide(ReturnRequestStatus.Rejected, now, note)
  }

  /** Called when a refund for this request is recorded. */
  markRefunded(): void {
    if (this.props.status !== ReturnRequestStatus.Approved) {
      throw new ReturnAlreadyDecidedError(this.props.status)
    }
    this.props.status = ReturnRequestStatus.Refunded
  }

  private decide(status: ReturnRequestStatus, now: Date, note?: string | null): void {
    if (this.props.status !== ReturnRequestStatus.Requested) {
      throw new ReturnAlreadyDecidedError(this.props.status)
    }
    const trimmed = note?.trim() || null
    if (trimmed && trimmed.length > NOTE_MAX) {
      throw new InvalidReturnRequestError(`Note must be at most ${NOTE_MAX} characters`)
    }
    this.props.status = status
    this.props.adminNote = trimmed
    this.props.decidedAt = now
  }

  get orderId(): number {
    return this.props.orderId
  }

  get userId(): number {
    return this.props.userId
  }

  get status(): ReturnRequestStatus {
    return this.props.status
  }

  get reason(): string {
    return this.props.reason
  }

  get adminNote(): string | null {
    return this.props.adminNote
  }

  get items(): readonly ReturnLine[] {
    return this.props.items
  }

  get decidedAt(): Date | null {
    return this.props.decidedAt
  }

  get createdAt(): Date {
    return this.props.createdAt
  }
}
