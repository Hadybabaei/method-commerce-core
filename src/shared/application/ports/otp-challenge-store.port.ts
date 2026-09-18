/**
 * Short-lived login challenges. Redis (or an in-memory stand-in) owns the TTL
 * so codes disappear after the configured window without a cron sweeper.
 */
export type OtpConsumeResult = 'ok' | 'missing' | 'mismatch'

export interface OtpChallengeStore {
  /** Replaces any prior code for this phone; returns the absolute expiry. */
  save(phoneNumber: string, code: string, ttlSeconds: number): Promise<Date>

  /**
   * Atomically validates and deletes the code. `missing` covers both
   * never-requested and TTL-expired keys.
   */
  consume(phoneNumber: string, code: string): Promise<OtpConsumeResult>
}

export const OTP_CHALLENGE_STORE = Symbol('OtpChallengeStore')
