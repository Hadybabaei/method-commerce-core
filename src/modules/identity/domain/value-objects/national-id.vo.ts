import { InvalidInputError } from '@shared/domain/errors'
import { ValueObject } from '@shared/domain/value-object.base'

interface NationalIdProps {
  value: string
}

/**
 * Iranian national id: ten digits validated with the official checksum.
 */
export class NationalId extends ValueObject<NationalIdProps> {
  private constructor(value: string) {
    super({ value })
  }

  static create(raw: string): NationalId {
    const value = String(raw ?? '').replace(/\D/g, '')

    if (!/^\d{10}$/.test(value) || /^(\d)\1{9}$/.test(value)) {
      throw new InvalidInputError('National id must be 10 digits', { nationalId: raw })
    }

    if (!NationalId.hasValidChecksum(value)) {
      throw new InvalidInputError('National id checksum is invalid', { nationalId: raw })
    }

    return new NationalId(value)
  }

  /** Rehydrates a stored national id without re-validating. */
  static fromPersistence(value: string): NationalId {
    return new NationalId(value)
  }

  private static hasValidChecksum(value: string): boolean {
    const digits = value.split('').map(Number)
    const checkDigit = digits[9]
    const sum = digits.slice(0, 9).reduce((total, digit, index) => total + digit * (10 - index), 0)
    const remainder = sum % 11

    return remainder < 2 ? checkDigit === remainder : checkDigit === 11 - remainder
  }

  get value(): string {
    return this.props.value
  }

  toString(): string {
    return this.props.value
  }
}
