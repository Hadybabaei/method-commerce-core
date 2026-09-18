import { registerAs } from '@nestjs/config'
import { toInt } from './parsers'

export const orderingJobsConfig = registerAs('orderingJobs', () => ({
  /** Auto-cancel ONLINE orders that stay unpaid this long (default 15 min). */
  unpaidCancelDelayMs: toInt(process.env.ORDER_UNPAID_CANCEL_DELAY_MS, 15 * 60 * 1000),
}))

export type OrderingJobsConfig = ReturnType<typeof orderingJobsConfig>
