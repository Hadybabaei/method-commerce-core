import { InvalidInputError } from '@shared/domain/errors'
import { toLatinDigits } from '@shared/domain/value-objects/iranian-mobile'
import { ValueObject } from '@shared/domain/value-object.base'

interface PostalCodeProps {
  value: string
}

/**
 * Iranian postal code: exactly ten digits, stored without separators so it can
 * be handed to shipping providers as-is.
 */
export class PostalCode extends ValueObject<PostalCodeProps> {
  private constructor(value: string) {
    super({ value })
  }

  static create(raw: string): PostalCode {
    const value = toLatinDigits(String(raw ?? '')).replace(/\D/g, '')

    if (value.length !== 10) {
      throw new InvalidInputError('Postal code must be exactly 10 digits', { postalCode: raw })
    }

    return new PostalCode(value)
  }

  static fromPersistence(value: string): PostalCode {
    return new PostalCode(value)
  }

  get value(): string {
    return this.props.value
  }

  toString(): string {
    return this.props.value
  }
}
