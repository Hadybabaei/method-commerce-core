import { Payment } from './entities/payment.entity'
import { OrderStatus, PaymentStatus } from './enums/order.enums'

/** Worker batch size — keep a 60s tick from overlapping the next run. */
export const PAYMENT_INQUIRY_BATCH_LIMIT = 50

/** Matches Zibal `AbortSignal.timeout` so lockDuration can cover a full batch. */
export const PAYMENT_INQUIRY_VERIFY_TIMEOUT_MS = 12_000

/**
 * BullMQ lock must outlive `BATCH_LIMIT` sequential verifies or the job is
 * stalled and replayed while the first run is still in flight.
 */
export const PAYMENT_INQUIRY_LOCK_DURATION_MS =
  PAYMENT_INQUIRY_BATCH_LIMIT * PAYMENT_INQUIRY_VERIFY_TIMEOUT_MS + 60_000

/** Abandoned INITIATED/FAILED sessions older than this are dropped from inquiry. */
export const PAYMENT_INQUIRY_MAX_AGE_MS = 24 * 60 * 60 * 1000

/** Current gatewayRef first, then at most one historical trackId. */
export const PAYMENT_INQUIRY_MAX_REFS_PER_PAYMENT = 2

type OrderInquiryView = {
  status: OrderStatus
}

/**
 * Whether the inquiry worker should verify or retry-fulfill this payment.
 *
 * INITIATED is only worth verifying while the order is still PENDING — after
 * unpaid-cancel the row stays INITIATED forever and would hammer the gateway.
 * FAILED stays eligible (including recently cancelled orders) because a closed
 * tab can still pay the trackId we already marked failed.
 * SUCCEEDED retries fulfillment unless operators already owe a refund.
 */
export function isPaymentInquiryCandidate(
  payment: Payment,
  order: OrderInquiryView,
  now: Date,
  maxAgeMs = PAYMENT_INQUIRY_MAX_AGE_MS
): boolean {
  if (payment.requiresRefund) {
    return false
  }

  if (payment.status === PaymentStatus.Succeeded) {
    return order.status === OrderStatus.Pending || order.status === OrderStatus.Cancelled
  }

  if (
    payment.status !== PaymentStatus.Initiated &&
    payment.status !== PaymentStatus.Failed
  ) {
    return false
  }

  if (!payment.gatewayRef) {
    return false
  }

  if (now.getTime() - payment.createdAt.getTime() > maxAgeMs) {
    return false
  }

  if (order.status === OrderStatus.Pending) {
    return true
  }

  return order.status === OrderStatus.Cancelled && payment.status === PaymentStatus.Failed
}

/** Current session first so a Failed retry does not re-verify a dead trackId first. */
export function inquiryGatewayRefs(
  payment: Payment,
  cap = PAYMENT_INQUIRY_MAX_REFS_PER_PAYMENT
): string[] {
  const ordered: string[] = []
  if (payment.gatewayRef) {
    ordered.push(payment.gatewayRef)
  }
  for (const ref of payment.knownGatewayRefs) {
    if (ref && !ordered.includes(ref)) {
      ordered.push(ref)
    }
  }
  return ordered.slice(0, cap)
}
