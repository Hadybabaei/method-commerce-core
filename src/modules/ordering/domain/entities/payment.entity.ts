import { UNSAVED_ID } from '@shared/domain/identifier'
import { PaymentStatus } from '../enums/order.enums'
import {
  IdempotencyConflictError,
  OrderNotPayableError,
} from '../errors/ordering.errors'

/** Marks a captured payment whose order could not be fulfilled. */
export const REFUND_REQUIRED_PREFIX = 'REFUND_REQUIRED: '

export interface PaymentProps {
  orderId: number
  idempotencyKey: string
  gatewayRef: string | null
  /** Every trackId ever attached, including ones replaced after a Failed retry. */
  knownGatewayRefs: string[]
  amount: number
  status: PaymentStatus
  failureReason: string | null
  redirectUrl: string | null
  createdAt: Date
  updatedAt: Date | null
}

/**
 * One online payment attempt for an order. The client idempotency key is the
 * uniqueness boundary: retries with the same key return this row instead of
 * opening a second charge.
 */
export class Payment {
  private props: PaymentProps

  private constructor(
    readonly id: number,
    props: PaymentProps
  ) {
    this.props = props
  }

  /** Persisted before the gateway call so a crash cannot orphan a trackId. */
  static draft(input: {
    orderId: number
    idempotencyKey: string
    amount: number
    now: Date
  }): Payment {
    return new Payment(UNSAVED_ID, {
      orderId: input.orderId,
      idempotencyKey: input.idempotencyKey,
      gatewayRef: null,
      knownGatewayRefs: [],
      amount: input.amount,
      status: PaymentStatus.Initiated,
      failureReason: null,
      redirectUrl: null,
      createdAt: input.now,
      updatedAt: null,
    })
  }

  static initiate(input: {
    orderId: number
    idempotencyKey: string
    amount: number
    gatewayRef: string
    redirectUrl: string
    now: Date
  }): Payment {
    const payment = Payment.draft(input)
    payment.attachGateway(
      { gatewayRef: input.gatewayRef, redirectUrl: input.redirectUrl },
      input.now
    )
    return payment
  }

  static fromPersistence(id: number, props: PaymentProps): Payment {
    return new Payment(id, {
      ...props,
      knownGatewayRefs: rememberedRefs(props.gatewayRef, props.knownGatewayRefs),
    })
  }

  get isNew(): boolean {
    return this.id === UNSAVED_ID
  }

  /**
   * Idempotent re-initiate: same order + amount is a no-op return; anything
   * else with this key is a client bug.
   */
  ensureMatchesInitiate(orderId: number, amount: number): void {
    if (this.props.orderId !== orderId || this.props.amount !== amount) {
      throw new IdempotencyConflictError()
    }
  }

  /**
   * True when this row already has a live gateway session the client can reuse.
   */
  get hasOpenGatewaySession(): boolean {
    return (
      this.props.status === PaymentStatus.Initiated &&
      this.props.gatewayRef !== null &&
      this.props.redirectUrl !== null
    )
  }

  /**
   * Binds (or replaces) a gateway session. Used after a draft persist and when
   * retrying the same idempotency key after a Failed attempt.
   */
  attachGateway(session: { gatewayRef: string; redirectUrl: string }, now: Date): void {
    if (this.props.status === PaymentStatus.Succeeded) {
      throw new OrderNotPayableError('A succeeded payment cannot start another gateway session')
    }

    this.props = {
      ...this.props,
      status: PaymentStatus.Initiated,
      gatewayRef: session.gatewayRef,
      knownGatewayRefs: rememberedRefs(session.gatewayRef, this.props.knownGatewayRefs),
      redirectUrl: session.redirectUrl,
      failureReason: null,
      updatedAt: now,
    }
  }

  markSucceeded(now: Date): void {
    if (this.props.status === PaymentStatus.Succeeded) {
      return
    }

    this.props = {
      ...this.props,
      status: PaymentStatus.Succeeded,
      failureReason: null,
      updatedAt: now,
    }
  }

  /**
   * The money is captured but the order could not be fulfilled (stock was sold
   * to someone else while the customer was at the gateway). Status stays
   * SUCCEEDED so the capture is never lost; the reason carries the refund flag
   * for operators.
   */
  flagRefundRequired(reason: string, now: Date): void {
    if (this.props.status !== PaymentStatus.Succeeded) {
      throw new OrderNotPayableError('Only a captured payment can require a refund', {
        status: this.props.status,
      })
    }

    this.props = {
      ...this.props,
      failureReason: `${REFUND_REQUIRED_PREFIX}${reason}`,
      updatedAt: now,
    }
  }

  /** A later retry fulfilled the order, so the refund flag no longer applies. */
  clearRefundRequirement(now: Date): void {
    if (!this.requiresRefund) {
      return
    }

    this.props = {
      ...this.props,
      failureReason: null,
      updatedAt: now,
    }
  }

  get requiresRefund(): boolean {
    return (
      this.props.status === PaymentStatus.Succeeded &&
      this.props.failureReason !== null &&
      this.props.failureReason.startsWith(REFUND_REQUIRED_PREFIX)
    )
  }

  markFailed(reason: string | null, now: Date): void {
    if (this.props.status === PaymentStatus.Succeeded) {
      throw new OrderNotPayableError('A succeeded payment cannot be marked failed')
    }

    if (this.props.status === PaymentStatus.Failed) {
      return
    }

    this.props = {
      ...this.props,
      status: PaymentStatus.Failed,
      failureReason: reason,
      updatedAt: now,
    }
  }

  get orderId(): number {
    return this.props.orderId
  }

  get idempotencyKey(): string {
    return this.props.idempotencyKey
  }

  get gatewayRef(): string | null {
    return this.props.gatewayRef
  }

  get knownGatewayRefs(): readonly string[] {
    return this.props.knownGatewayRefs
  }

  get isCaptured(): boolean {
    return this.props.status === PaymentStatus.Succeeded
  }

  get amount(): number {
    return this.props.amount
  }

  get status(): PaymentStatus {
    return this.props.status
  }

  get failureReason(): string | null {
    return this.props.failureReason
  }

  get redirectUrl(): string | null {
    return this.props.redirectUrl
  }

  get createdAt(): Date {
    return this.props.createdAt
  }

  get updatedAt(): Date | null {
    return this.props.updatedAt
  }
}

function rememberedRefs(current: string | null, known: string[] | undefined): string[] {
  const refs: string[] = []
  for (const ref of known ?? []) {
    if (ref && !refs.includes(ref)) {
      refs.push(ref)
    }
  }
  if (current && !refs.includes(current)) {
    refs.push(current)
  }
  return refs
}
