import { InvalidInputError } from '@shared/domain/errors'
import { ValueObject } from '@shared/domain/value-object.base'

interface SkuProps {
  value: string
}

const SKU_PATTERN = /^[A-Z0-9][A-Z0-9._-]{1,39}$/

/**
 * Stock keeping unit: the human-readable, stable identifier for one sellable
 * variant. The legacy schema had no such field, which left database ids as the
 * only way to refer to a variant from a warehouse sheet or a marketplace feed.
 */
export class Sku extends ValueObject<SkuProps> {
  private constructor(value: string) {
    super({ value })
  }

  static create(input: string): Sku {
    const normalized = (input ?? '').trim().toUpperCase()

    if (!SKU_PATTERN.test(normalized)) {
      throw new InvalidInputError(
        'SKU must be 2 to 40 characters of letters, digits, dot, dash or underscore',
        { sku: input }
      )
    }

    return new Sku(normalized)
  }

  static fromPersistence(value: string): Sku {
    return new Sku(value)
  }

  get value(): string {
    return this.props.value
  }

  toString(): string {
    return this.props.value
  }
}
