/**
 * Schedules auto-cancel for ONLINE orders that never complete payment.
 * BullMQ delayed jobs are the production adapter; tests use a no-op.
 */
export interface OrderPaymentTimeoutScheduler {
  /**
   * False for the Noop adapter (Redis/jobs off). ONLINE checkout must not
   * proceed when this is false — unpaid orders would never auto-cancel.
   */
  readonly isOperational: boolean

  scheduleCancelIfUnpaid(orderId: number, delayMs: number): Promise<void>

  /** Drop a pending job after pay or manual cancel. */
  cancelScheduled(orderId: number): Promise<void>
}

export const ORDER_PAYMENT_TIMEOUT_SCHEDULER = Symbol('OrderPaymentTimeoutScheduler')

/** Bound only by OrderingJobsModule — the ordering module resolves it lazily. */
export const BULLMQ_ORDER_PAYMENT_TIMEOUT_SCHEDULER = Symbol(
  'BullmqOrderPaymentTimeoutScheduler'
)

export const UNPAID_ORDER_QUEUE = 'order-payment-timeout'
export const CANCEL_UNPAID_ORDER_JOB = 'cancel-unpaid-order'

export type CancelUnpaidOrderJobData = {
  orderId: number
}
