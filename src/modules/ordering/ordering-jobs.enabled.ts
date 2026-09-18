/** Whether BullMQ unpaid-order jobs should be wired (requires Redis). */
export function isOrderingJobsEnabled(): boolean {
  const explicit = process.env.REDIS_ENABLED
  if (explicit !== undefined) {
    return explicit.toLowerCase() !== 'false'
  }
  return process.env.NODE_ENV !== 'test'
}

/**
 * ONLINE checkout depends on the unpaid-cancel delay and the inquiry worker.
 * Booting production with the Noop scheduler would leave captures unsettled
 * and unpaid orders uncancelled.
 */
export function assertProductionOrderingJobs(): void {
  if (process.env.NODE_ENV !== 'production') {
    return
  }
  if (!isOrderingJobsEnabled()) {
    throw new Error(
      'ONLINE checkout requires Redis/BullMQ in production. Unset REDIS_ENABLED=false or disable production until jobs can run.'
    )
  }
}
