import { InvalidInputError } from '@shared/domain/errors'
import { normalizeIranianMobile } from '@shared/domain/value-objects/iranian-mobile'
import { ValueObject } from '@shared/domain/value-object.base'

interface PhoneNumberProps {
  value: string
}

/**
 * The identifier a customer logs in with. Always stored as `09xxxxxxxxx`, so a
 * number typed as `+98 912 ...`, `0098912...` or with Persian digits resolves
 * to the same account.
 */
export class PhoneNumber extends ValueObject<PhoneNumberProps> {
  private constructor(value: string) {
    super({ value })
  }

  static create(raw: string): PhoneNumber {
    if (typeof raw !== 'string' || raw.trim() === '') {
      throw new InvalidInputError('Phone number is required')
    }

    const normalized = normalizeIranianMobile(raw)

    if (!normalized) {
      throw new InvalidInputError('Phone number must be a valid Iranian mobile number', {
        phoneNumber: raw,
      })
    }

    return new PhoneNumber(normalized)
  }

  /**
   * Rehydrates a stored number without re-validating: legacy rows may hold
   * formats that today's rules would reject, and refusing to load them would be
   * worse than accepting them.
   */
  static fromPersistence(value: string): PhoneNumber {
    return new PhoneNumber(value)
  }

  get value(): string {
    return this.props.value
  }

  /** `0912***4567` - safe to return in responses and logs. */
  get masked(): string {
    return `${this.props.value.slice(0, 4)}***${this.props.value.slice(-4)}`
  }

  toString(): string {
    return this.props.value
  }
}
