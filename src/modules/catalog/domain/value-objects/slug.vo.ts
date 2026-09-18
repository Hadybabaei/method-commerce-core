import { InvalidInputError } from '@shared/domain/errors'
import { ValueObject } from '@shared/domain/value-object.base'

interface SlugProps {
  value: string
}

const MAX_LENGTH = 190

/**
 * URL segment identifying a category, brand or product.
 *
 * Persian letters are kept rather than transliterated, because the storefront
 * URLs are Persian and browsers percent-encode them without trouble.
 */
export class Slug extends ValueObject<SlugProps> {
  private constructor(value: string) {
    super({ value })
  }

  /** Normalizes free text into a slug. */
  static create(input: string): Slug {
    const normalized = Slug.normalize(input)

    if (normalized.length === 0) {
      throw new InvalidInputError('Slug cannot be empty', { input })
    }

    if (normalized.length > MAX_LENGTH) {
      throw new InvalidInputError(`Slug cannot be longer than ${MAX_LENGTH} characters`)
    }

    return new Slug(normalized)
  }

  /** Trusts a value already stored in the database. */
  static fromPersistence(value: string): Slug {
    return new Slug(value)
  }

  private static normalize(input: string): string {
    return (
      (input ?? '')
        .trim()
        .toLowerCase()
        .replace(/[\s_]+/g, '-')
        // Anything that is not a letter, a digit or a hyphen is dropped. The `u`
        // flag makes \p{L} cover Persian and Arabic letters too.
        .replace(/[^\p{L}\p{N}-]+/gu, '')
        .replace(/-{2,}/g, '-')
        .replace(/^-+|-+$/g, '')
    )
  }

  get value(): string {
    return this.props.value
  }

  toString(): string {
    return this.props.value
  }
}
