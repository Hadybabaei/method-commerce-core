import { InvalidInputError } from '@shared/domain/errors'
import { ValueObject } from '@shared/domain/value-object.base'

export const SEO_TITLE_MAX = 120
export const SEO_DESCRIPTION_MAX = 320

interface SeoMetaProps {
  title: string | null
  description: string | null
}

export type SeoMetaChanges = { title?: string | null; description?: string | null }

/**
 * Search-engine title and description for a catalog page. Null means "use the
 * entry's own title / description".
 */
export class SeoMeta extends ValueObject<SeoMetaProps> {
  private constructor(props: SeoMetaProps) {
    super(props)
  }

  static readonly empty = new SeoMeta({ title: null, description: null })

  static create(input: SeoMetaChanges = {}): SeoMeta {
    return new SeoMeta({
      title: SeoMeta.normalize(input.title, SEO_TITLE_MAX, 'SEO title'),
      description: SeoMeta.normalize(input.description, SEO_DESCRIPTION_MAX, 'SEO description'),
    })
  }

  static fromPersistence(title: string | null, description: string | null): SeoMeta {
    return new SeoMeta({ title, description })
  }

  /** Fields left undefined keep their current value. */
  merge(changes: SeoMetaChanges): SeoMeta {
    return SeoMeta.create({
      title: changes.title !== undefined ? changes.title : this.props.title,
      description: changes.description !== undefined ? changes.description : this.props.description,
    })
  }

  get title(): string | null {
    return this.props.title
  }

  get description(): string | null {
    return this.props.description
  }

  private static normalize(
    value: string | null | undefined,
    max: number,
    label: string
  ): string | null {
    const trimmed = value?.replace(/\s+/g, ' ').trim()
    if (!trimmed) {
      return null
    }
    if (trimmed.length > max) {
      throw new InvalidInputError(`${label} must be at most ${max} characters`, {
        max,
        length: trimmed.length,
      })
    }
    return trimmed
  }
}
