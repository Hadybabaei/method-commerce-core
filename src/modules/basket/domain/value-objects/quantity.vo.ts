import { InvalidInputError } from '@shared/domain/errors'
import { ValueObject } from '@shared/domain/value-object.base'

export const MAX_BASKET_LINE_QUANTITY = 99

interface QuantityProps {
  value: number
}

/**
 * How many of one variant sit in the basket. Zero means "remove the line".
 */
export class Quantity extends ValueObject<QuantityProps> {
  private constructor(value: number) {
    super({ value })
  }

  static of(value: number): Quantity {
    if (!Number.isInteger(value) || value < 0) {
      throw new InvalidInputError('Quantity must be a whole number of zero or more', { value })
    }
    if (value > MAX_BASKET_LINE_QUANTITY) {
      throw new InvalidInputError(`Quantity cannot exceed ${MAX_BASKET_LINE_QUANTITY}`, {
        value,
        max: MAX_BASKET_LINE_QUANTITY,
      })
    }

    return new Quantity(value)
  }

  static one(): Quantity {
    return new Quantity(1)
  }

  get value(): number {
    return this.props.value
  }

  get isZero(): boolean {
    return this.props.value === 0
  }

  add(other: Quantity): Quantity {
    return Quantity.of(this.props.value + other.value)
  }

  subtract(other: Quantity): Quantity {
    return Quantity.of(Math.max(0, this.props.value - other.value))
  }
}
