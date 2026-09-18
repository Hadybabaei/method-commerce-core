import { InvalidInputError } from '@shared/domain/errors'
import { ValueObject } from '@shared/domain/value-object.base'

interface CategoryPathProps {
  value: string
}

/** Root categories have depth 0, so this allows five levels in total. */
export const MAX_CATEGORY_DEPTH = 4

/**
 * The ancestor chain of a category, written as `/1/7/`.
 *
 * It holds ancestors only, never the category's own id, so a brand new
 * category already knows its path before the database has given it an id. A
 * category's own subtree is addressed with `subtreePrefix`.
 */
export class CategoryPath extends ValueObject<CategoryPathProps> {
  private constructor(value: string) {
    super({ value })
  }

  /** Path of a category that has no parent. */
  static root(): CategoryPath {
    return new CategoryPath('/')
  }

  static fromPersistence(value: string): CategoryPath {
    if (!value.startsWith('/') || !value.endsWith('/')) {
      throw new InvalidInputError('Category path must start and end with a slash', { value })
    }

    return new CategoryPath(value)
  }

  /** The path every child of the category with this id will carry. */
  childPath(ownId: number): CategoryPath {
    return new CategoryPath(`${this.props.value}${ownId}/`)
  }

  /** Prefix matching the category itself plus everything beneath it. */
  subtreePrefix(ownId: number): string {
    return `${this.props.value}${ownId}/`
  }

  get ancestorIds(): number[] {
    return this.props.value
      .split('/')
      .filter((segment) => segment.length > 0)
      .map(Number)
  }

  get depth(): number {
    return this.ancestorIds.length
  }

  get parentId(): number | null {
    const ids = this.ancestorIds

    return ids.length === 0 ? null : ids[ids.length - 1]
  }

  startsWith(prefix: string): boolean {
    return this.props.value.startsWith(prefix)
  }

  /** Used when a whole subtree moves to a new parent. */
  withReplacedPrefix(oldPrefix: string, newPrefix: string): CategoryPath {
    return new CategoryPath(this.props.value.replace(oldPrefix, newPrefix))
  }

  get value(): string {
    return this.props.value
  }

  toString(): string {
    return this.props.value
  }
}
