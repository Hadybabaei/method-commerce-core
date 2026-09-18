import { NumericEntity } from '@shared/domain/entity.base'
import { InvalidInputError } from '@shared/domain/errors'
import { UNSAVED_ID } from '@shared/domain/identifier'

export interface ProductOptionValueProps {
  value: string
  position: number
}

/** One allowed value of an option, e.g. "قرمز" for the option "رنگ". */
export class ProductOptionValue extends NumericEntity {
  private constructor(
    id: number,
    private readonly props: ProductOptionValueProps
  ) {
    super(id)
  }

  static create(value: string, position: number): ProductOptionValue {
    const trimmed = (value ?? '').trim()

    if (trimmed.length === 0) {
      throw new InvalidInputError('Option value cannot be empty')
    }

    return new ProductOptionValue(UNSAVED_ID, { value: trimmed, position })
  }

  static fromPersistence(id: number, props: ProductOptionValueProps): ProductOptionValue {
    return new ProductOptionValue(id, props)
  }

  matches(value: string): boolean {
    return this.props.value.toLowerCase() === value.trim().toLowerCase()
  }

  get value(): string {
    return this.props.value
  }

  get position(): number {
    return this.props.position
  }
}

export interface ProductOptionProps {
  name: string
  position: number
  values: ProductOptionValue[]
}

/**
 * An axis a product varies on. The set of options a product declares is what
 * every one of its variants must answer, which is the rule the legacy schema
 * had no way to express.
 */
export class ProductOption extends NumericEntity {
  private constructor(
    id: number,
    private readonly props: ProductOptionProps
  ) {
    super(id)
  }

  static create(name: string, values: string[], position: number): ProductOption {
    const trimmed = (name ?? '').trim()

    if (trimmed.length === 0) {
      throw new InvalidInputError('Option name cannot be empty')
    }

    if (!values || values.length === 0) {
      throw new InvalidInputError(`Option "${trimmed}" needs at least one value`)
    }

    const unique = new Set(values.map((value) => value.trim().toLowerCase()))

    if (unique.size !== values.length) {
      throw new InvalidInputError(`Option "${trimmed}" lists the same value twice`)
    }

    return new ProductOption(UNSAVED_ID, {
      name: trimmed,
      position,
      values: values.map((value, index) => ProductOptionValue.create(value, index)),
    })
  }

  static fromPersistence(id: number, props: ProductOptionProps): ProductOption {
    return new ProductOption(id, props)
  }

  hasName(name: string): boolean {
    return this.props.name.toLowerCase() === (name ?? '').trim().toLowerCase()
  }

  findValue(value: string): ProductOptionValue | null {
    return this.props.values.find((candidate) => candidate.matches(value)) ?? null
  }

  get name(): string {
    return this.props.name
  }

  get position(): number {
    return this.props.position
  }

  get values(): readonly ProductOptionValue[] {
    return this.props.values
  }
}
