/**
 * Injecting "now" keeps expiry rules (OTP, reset tokens) deterministic in tests.
 */
export interface Clock {
  now(): Date
  /** `now` shifted forward by the given number of seconds. */
  secondsFromNow(seconds: number): Date
}

export const CLOCK = Symbol('Clock')
