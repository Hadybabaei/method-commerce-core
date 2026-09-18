import { Payment } from '../entities/payment.entity'

export interface PaymentRepository {
  findById(id: number): Promise<Payment | null>

  findByIdempotencyKey(key: string): Promise<Payment | null>

  findByGatewayRef(gatewayRef: string): Promise<Payment | null>

  /**
   * Latest INITIATED, FAILED, or SUCCEEDED payment for the order, if any.
   * FAILED stays in-flight while inquiry can still capture the old trackId.
   */
  findInFlightByOrderId(orderId: number, tx?: unknown): Promise<Payment | null>

  /** Locks the payment row (`FOR UPDATE`) then loads the aggregate. */
  findByIdForUpdate(id: number, tx: unknown): Promise<Payment | null>

  /**
   * Recent INITIATED/FAILED sessions and unfulfilled SUCCEEDED captures the
   * inquiry worker should verify or retry-fulfill.
   */
  listOpenForInquiry(limit?: number, now?: Date): Promise<Payment[]>

  save(payment: Payment, tx?: unknown): Promise<Payment>
}

export const PAYMENT_REPOSITORY = Symbol('PaymentRepository')
