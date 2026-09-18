import {
  PAYMENT_INQUIRY_LOCK_DURATION_MS,
} from '../../domain/payment-inquiry'

export const PAYMENT_INQUIRY_QUEUE = 'payment-inquiry'
export const INQUIRE_OPEN_PAYMENTS_JOB = 'inquire-open-payments'
export const PAYMENT_INQUIRY_REPEAT_JOB_ID = 'inquire-open-payments-repeat'

/** BullMQ worker options — one run at a time, lock covers a full sequential batch. */
export const INQUIRE_OPEN_PAYMENTS_WORKER_OPTIONS = {
  concurrency: 1,
  lockDuration: PAYMENT_INQUIRY_LOCK_DURATION_MS,
} as const
