import {
  OtpChallengeStore,
  OtpConsumeResult,
} from '@shared/application/ports/otp-challenge-store.port'
import { PrismaService } from './prisma.service'

/**
 * OTP challenges in MySQL, for hosts without Redis where requests may land on
 * different instances (serverless). Consuming deletes the row conditionally,
 * so a code works once even under concurrent verifies.
 */
export class PrismaOtpChallengeStore implements OtpChallengeStore {
  constructor(
    private readonly prisma: PrismaService,
    private readonly nowMs: () => number = () => Date.now()
  ) {}

  async save(phoneNumber: string, code: string, ttlSeconds: number): Promise<Date> {
    const expiresAt = new Date(this.nowMs() + ttlSeconds * 1000)
    await this.prisma.otp_challenge.upsert({
      where: { phone_number: phoneNumber },
      create: { phone_number: phoneNumber, code, expires_at: expiresAt },
      update: { code, expires_at: expiresAt },
    })
    return expiresAt
  }

  async consume(phoneNumber: string, code: string): Promise<OtpConsumeResult> {
    const now = new Date(this.nowMs())
    const { count } = await this.prisma.otp_challenge.deleteMany({
      where: {
        phone_number: phoneNumber,
        code: String(code ?? '').trim(),
        expires_at: { gt: now },
      },
    })
    if (count === 1) return 'ok'

    const entry = await this.prisma.otp_challenge.findUnique({
      where: { phone_number: phoneNumber },
    })
    if (!entry || entry.expires_at <= now) {
      if (entry)
        await this.prisma.otp_challenge.deleteMany({ where: { phone_number: phoneNumber } })
      return 'missing'
    }
    return 'mismatch'
  }
}
