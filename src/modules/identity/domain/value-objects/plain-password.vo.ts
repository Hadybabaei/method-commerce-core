import { InvalidInputError } from '@shared/domain/errors'
import { ValueObject } from '@shared/domain/value-object.base'

const MIN_LENGTH = 8
const MAX_LENGTH = 72 // bcrypt silently truncates beyond this

interface PlainPasswordProps {
  value: string
}

/**
 * A password before hashing. Exists so the password policy lives in the domain
 * instead of being duplicated across request DTOs.
 */
export class PlainPassword extends ValueObject<PlainPasswordProps> {
  private constructor(value: string) {
    super({ value })
  }

  static create(raw: string): PlainPassword {
    const value = raw ?? ''

    if (value.length < MIN_LENGTH) {
      throw new InvalidInputError(`Password must be at least ${MIN_LENGTH} characters long`)
    }

    if (value.length > MAX_LENGTH) {
      throw new InvalidInputError(`Password must be at most ${MAX_LENGTH} characters long`)
    }

    if (!/[a-zA-Z]/.test(value) || !/\d/.test(value)) {
      throw new InvalidInputError('Password must contain at least one letter and one digit')
    }

    return new PlainPassword(value)
  }

  get value(): string {
    return this.props.value
  }
}
