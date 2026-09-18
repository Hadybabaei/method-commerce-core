import { registerAs } from '@nestjs/config'
import { toInt } from './parsers'

export const orderingJobsConfig = registerAs('orderingJobs', () => ({
  /** Auto-cancel ONLINE orders that stay unpaid this long (default 15 min). */
  unpaidCancelDelayMs: toInt(process.env.ORDER_UNPAID_CANCEL_DELAY_MS, 15 * 60 * 1000),
  /** How often to inquire Zibal for recent INITIATED/FAILED / unfulfilled SUCCEEDED payments. */
  inquiryIntervalMs: toInt(process.env.ORDER_PAYMENT_INQUIRY_INTERVAL_MS, 60_000),
}))

export type OrderingJobsConfig = ReturnType<typeof orderingJobsConfig>
