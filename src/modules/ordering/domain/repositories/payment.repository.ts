import { Payment } from '../entities/payment.entity'

export interface PaymentRepository {
  findById(id: number): Promise<Payment | null>

  findByIdempotencyKey(key: string): Promise<Payment | null>

  findByGatewayRef(gatewayRef: string): Promise<Payment | null>

  /**
   * Latest INITIATED or SUCCEEDED payment for the order, if any.
   * Used so a second Idempotency-Key cannot open another charge.
   */
  findInFlightByOrderId(orderId: number, tx?: unknown): Promise<Payment | null>

  /** Locks the payment row (`FOR UPDATE`) then loads the aggregate. */
  findByIdForUpdate(id: number, tx: unknown): Promise<Payment | null>

  save(payment: Payment, tx?: unknown): Promise<Payment>
}

export const PAYMENT_REPOSITORY = Symbol('PaymentRepository')
