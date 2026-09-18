import { InvalidInputError } from '@shared/domain/errors'
import { ValueObject } from '@shared/domain/value-object.base'

export interface OptionSelection {
  /** Name of the option, e.g. "رنگ". */
  option: string
  /** Chosen value, e.g. "قرمز". */
  value: string
}

interface VariantSelectionProps {
  selections: OptionSelection[]
}

/**
 * The option values that define one variant: colour red *and* size large.
 *
 * This is what makes a variant identifiable by what it is rather than by its
 * row id. `signature` is the normalized form the database uses to reject a
 * duplicate combination, and it is built from names and values rather than
 * ids so a product and its variants can be created in a single request.
 */
export class VariantSelection extends ValueObject<VariantSelectionProps> {
  private constructor(selections: OptionSelection[]) {
    super({ selections })
  }

  /** The selection for a product that does not vary (no option axes). */
  static none(): VariantSelection {
    return new VariantSelection([])
  }

  static create(input: OptionSelection[]): VariantSelection {
    if (!input || input.length === 0) {
      return VariantSelection.none()
    }

    const selections = input.map((selection) => ({
      option: VariantSelection.normalize(selection.option, 'Option name'),
      value: VariantSelection.normalize(selection.value, 'Option value'),
    }))

    const names = new Set(selections.map((selection) => selection.option.toLowerCase()))

    if (names.size !== selections.length) {
      throw new InvalidInputError('A variant cannot select the same option twice')
    }

    return new VariantSelection(selections)
  }

  private static normalize(value: string, label: string): string {
    const trimmed = (value ?? '').trim()

    if (trimmed.length === 0) {
      throw new InvalidInputError(`${label} cannot be empty`)
    }

    return trimmed
  }

  /**
   * Order-independent fingerprint, e.g. `رنگ:قرمز|سایز:بزرگ`. Sorted so that
   * the same combination sent in a different order is still recognised as a
   * duplicate.
   */
  get signature(): string {
    return this.props.selections
      .map((selection) => `${selection.option.toLowerCase()}:${selection.value.toLowerCase()}`)
      .sort()
      .join('|')
  }

  get selections(): readonly OptionSelection[] {
    return this.props.selections
  }

  get optionNames(): string[] {
    return this.props.selections.map((selection) => selection.option)
  }

  valueFor(option: string): string | null {
    const match = this.props.selections.find(
      (selection) => selection.option.toLowerCase() === option.toLowerCase()
    )

    return match ? match.value : null
  }
}
