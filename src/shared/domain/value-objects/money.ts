import { InvalidInputError } from '../errors'
import { ValueObject } from '../value-object.base'

/**
 * Largest amount that can be stored. The database column is a signed 32-bit
 * integer, so this leaves plenty of headroom while still failing loudly rather
 * than silently truncating.
 */
export const MAX_MONEY_AMOUNT = 2_000_000_000

interface MoneyProps {
  /** Smallest currency unit (Rial). Always an integer. */
  amount: number
}

/**
 * An amount of money held as a whole number of the smallest currency unit.
 *
 * Floats are not used anywhere: `0.1 + 0.2` style drift is invisible on a
 * single price and very visible on an invoice total.
 */
export class Money extends ValueObject<MoneyProps> {
  private constructor(amount: number) {
    super({ amount })
  }

  static fromMinor(amount: number): Money {
    if (!Number.isInteger(amount)) {
      throw new InvalidInputError('Price must be a whole number of Rial', { amount })
    }

    if (amount < 0) {
      throw new InvalidInputError('Price cannot be negative', { amount })
    }

    if (amount > MAX_MONEY_AMOUNT) {
      throw new InvalidInputError(`Price cannot exceed ${MAX_MONEY_AMOUNT}`, { amount })
    }

    return new Money(amount)
  }

  static readonly zero = new Money(0)

  get amount(): number {
    return this.props.amount
  }

  get isZero(): boolean {
    return this.props.amount === 0
  }

  add(other: Money): Money {
    return Money.fromMinor(this.props.amount + other.amount)
  }

  subtract(other: Money): Money {
    return Money.fromMinor(this.props.amount - other.amount)
  }

  multiply(factor: number): Money {
    if (!Number.isInteger(factor) || factor < 0) {
      throw new InvalidInputError('Money can only be multiplied by a whole, positive number', {
        factor,
      })
    }

    return Money.fromMinor(this.props.amount * factor)
  }

  isLessThan(other: Money): boolean {
    return this.props.amount < other.amount
  }

  isGreaterThan(other: Money): boolean {
    return this.props.amount > other.amount
  }

  /**
   * Percentage off, rounded to the nearest whole unit. Only used for display;
   * the discounted amount itself is always stored explicitly.
   */
  percentageOff(discounted: Money): number {
    if (this.isZero || !discounted.isLessThan(this)) {
      return 0
    }

    return Math.round(((this.props.amount - discounted.amount) / this.props.amount) * 100)
  }

  toString(): string {
    return String(this.props.amount)
  }
}
