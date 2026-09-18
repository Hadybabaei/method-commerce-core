import { Injectable } from '@nestjs/common'
import {
  OtpChallengeStore,
  OtpConsumeResult,
} from '@shared/application/ports/otp-challenge-store.port'

/**
 * Process-local OTP store for tests / Redis-disabled environments.
 * Expiry is enforced on read so behaviour matches Redis TTL.
 */
@Injectable()
export class InMemoryOtpChallengeStore implements OtpChallengeStore {
  private readonly entries = new Map<string, { code: string; expiresAt: number }>()

  constructor(private readonly nowMs: () => number = () => Date.now()) {}

  async save(phoneNumber: string, code: string, ttlSeconds: number): Promise<Date> {
    const expiresAt = this.nowMs() + ttlSeconds * 1000
    this.entries.set(phoneNumber, { code, expiresAt })
    return new Date(expiresAt)
  }

  async consume(phoneNumber: string, code: string): Promise<OtpConsumeResult> {
    const entry = this.entries.get(phoneNumber)
    if (!entry || entry.expiresAt <= this.nowMs()) {
      this.entries.delete(phoneNumber)
      return 'missing'
    }

    if (entry.code !== String(code ?? '').trim()) {
      return 'mismatch'
    }

    this.entries.delete(phoneNumber)
    return 'ok'
  }
}
