import { AggregateRoot } from '@shared/domain/aggregate-root.base'
import { InvalidInputError } from '@shared/domain/errors'
import { UNSAVED_ID } from '@shared/domain/identifier'
import { Slug } from '../value-objects/slug.vo'

export interface BrandProps {
  title: string
  slug: Slug
  logo: string | null
  description: string | null
}

export type BrandChanges = Partial<BrandProps>

export class Brand extends AggregateRoot {
  private props: BrandProps

  private constructor(id: number, props: BrandProps) {
    super(id)
    this.props = props
  }

  static create(props: BrandProps): Brand {
    Brand.assertTitle(props.title)

    return new Brand(UNSAVED_ID, props)
  }

  static fromPersistence(id: number, props: BrandProps): Brand {
    return new Brand(id, props)
  }

  apply(changes: BrandChanges): void {
    if (changes.title !== undefined) {
      Brand.assertTitle(changes.title)
      this.props.title = changes.title
    }

    if (changes.slug !== undefined) this.props.slug = changes.slug
    if (changes.logo !== undefined) this.props.logo = changes.logo
    if (changes.description !== undefined) this.props.description = changes.description
  }

  private static assertTitle(title: string): void {
    if (!title || title.trim().length < 2) {
      throw new InvalidInputError('Brand title must be at least 2 characters long')
    }
  }

  get title(): string {
    return this.props.title
  }

  get slug(): Slug {
    return this.props.slug
  }

  get logo(): string | null {
    return this.props.logo
  }

  get description(): string | null {
    return this.props.description
  }
}
