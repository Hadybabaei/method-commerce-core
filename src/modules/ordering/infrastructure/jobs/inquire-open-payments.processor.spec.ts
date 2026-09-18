import {
  PAYMENT_INQUIRY_BATCH_LIMIT,
  PAYMENT_INQUIRY_LOCK_DURATION_MS,
  PAYMENT_INQUIRY_VERIFY_TIMEOUT_MS,
} from '../../domain/payment-inquiry'
import { INQUIRE_OPEN_PAYMENTS_WORKER_OPTIONS } from '../../application/ports/payment-inquiry.port'

describe('payment inquiry worker options', () => {
  it('locks longer than a full sequential batch of gateway verifies', () => {
    expect(INQUIRE_OPEN_PAYMENTS_WORKER_OPTIONS.concurrency).toBe(1)
    expect(INQUIRE_OPEN_PAYMENTS_WORKER_OPTIONS.lockDuration).toBe(PAYMENT_INQUIRY_LOCK_DURATION_MS)
    expect(PAYMENT_INQUIRY_LOCK_DURATION_MS).toBeGreaterThanOrEqual(
      PAYMENT_INQUIRY_BATCH_LIMIT * PAYMENT_INQUIRY_VERIFY_TIMEOUT_MS
    )
  })
})
