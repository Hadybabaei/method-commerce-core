import { ValueObject } from '@shared/domain/value-object.base'

interface PasswordResetTokenProps {
  token: string
  expiresAt: Date
}

export class PasswordResetToken extends ValueObject<PasswordResetTokenProps> {
  private constructor(props: PasswordResetTokenProps) {
    super(props)
  }

  static create(token: string, expiresAt: Date): PasswordResetToken {
    return new PasswordResetToken({ token, expiresAt })
  }

  get token(): string {
    return this.props.token
  }

  get expiresAt(): Date {
    return this.props.expiresAt
  }

  isExpired(now: Date): boolean {
    return this.props.expiresAt.getTime() <= now.getTime()
  }

  matches(candidate: string): boolean {
    return this.props.token === String(candidate ?? '').trim()
  }
}
