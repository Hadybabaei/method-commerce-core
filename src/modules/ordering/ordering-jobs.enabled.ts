/** Whether BullMQ unpaid-order jobs should be wired (requires Redis). */
export function isOrderingJobsEnabled(): boolean {
  const explicit = process.env.REDIS_ENABLED
  if (explicit !== undefined) {
    return explicit.toLowerCase() !== 'false'
  }
  return process.env.NODE_ENV !== 'test'
}
