import { InvalidInputError } from '@shared/domain/errors'
import { ValueObject } from '@shared/domain/value-object.base'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

interface EmailAddressProps {
  value: string
}

export class EmailAddress extends ValueObject<EmailAddressProps> {
  private constructor(value: string) {
    super({ value })
  }

  static create(raw: string): EmailAddress {
    const normalized = (raw ?? '').trim().toLowerCase()

    if (!EMAIL.test(normalized)) {
      throw new InvalidInputError('A valid email address is required', { email: raw })
    }

    return new EmailAddress(normalized)
  }

  /** Rehydrates a stored address without re-validating. */
  static fromPersistence(value: string): EmailAddress {
    return new EmailAddress(value)
  }

  get value(): string {
    return this.props.value
  }

  toString(): string {
    return this.props.value
  }
}
