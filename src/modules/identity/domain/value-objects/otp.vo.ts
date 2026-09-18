import { InvalidInputError } from '@shared/domain/errors'
import { ValueObject } from '@shared/domain/value-object.base'

interface OtpProps {
  code: string
  expiresAt: Date
}

/**
 * A one-time code together with its deadline. Keeping the two together makes it
 * impossible to check the code without also checking expiry.
 */
export class Otp extends ValueObject<OtpProps> {
  private constructor(props: OtpProps) {
    super(props)
  }

  static create(code: string, expiresAt: Date): Otp {
    if (!/^\d{4,8}$/.test(code ?? '')) {
      throw new InvalidInputError('OTP code must be 4 to 8 digits')
    }

    return new Otp({ code, expiresAt })
  }

  /** Rehydrates an OTP from storage without re-applying format rules. */
  static fromPersistence(code: string, expiresAt: Date): Otp {
    return new Otp({ code, expiresAt })
  }

  get code(): string {
    return this.props.code
  }

  get expiresAt(): Date {
    return this.props.expiresAt
  }

  isExpired(now: Date): boolean {
    return this.props.expiresAt.getTime() <= now.getTime()
  }

  matches(candidate: string): boolean {
    return this.props.code === String(candidate ?? '').trim()
  }
}
