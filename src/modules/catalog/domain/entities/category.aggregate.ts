import { AggregateRoot } from '@shared/domain/aggregate-root.base'
import { InvalidInputError } from '@shared/domain/errors'
import { UNSAVED_ID } from '@shared/domain/identifier'
import { CategoryCycleError, CategoryTooDeepError } from '../errors/catalog.errors'
import { CategoryMovedEvent } from '../events/catalog.events'
import { CategoryPath, MAX_CATEGORY_DEPTH } from '../value-objects/category-path.vo'
import { Slug } from '../value-objects/slug.vo'

export interface CategoryProps {
  title: string
  slug: Slug
  icon: string | null
  description: string | null
  parentId: number | null
  path: CategoryPath
  position: number
}

export interface CategoryChanges {
  title?: string
  slug?: Slug
  icon?: string | null
  description?: string | null
  position?: number
}

/**
 * A node in the category tree.
 *
 * Its place in the tree is held twice: `parentId` for writes and `path` for
 * reads. Keeping the materialized path in the aggregate means the rule that
 * creates it lives with the rule that validates it.
 */
export class Category extends AggregateRoot {
  private props: CategoryProps

  private constructor(id: number, props: CategoryProps) {
    super(id)
    this.props = props
  }

  /**
   * Creates a category under `parent`, or at the root when `parent` is null.
   * The parent is passed as a whole aggregate because its path and depth are
   * what decide whether this is allowed.
   */
  static create(
    props: Omit<CategoryProps, 'path' | 'parentId'> & { parent: Category | null }
  ): Category {
    const { parent, ...rest } = props

    Category.assertTitle(rest.title)

    const path = parent === null ? CategoryPath.root() : parent.path.childPath(parent.id)

    if (path.depth > MAX_CATEGORY_DEPTH) {
      throw new CategoryTooDeepError()
    }

    return new Category(UNSAVED_ID, {
      ...rest,
      parentId: parent === null ? null : parent.id,
      path,
    })
  }

  static fromPersistence(id: number, props: CategoryProps): Category {
    return new Category(id, props)
  }

  apply(changes: CategoryChanges): void {
    if (changes.title !== undefined) {
      Category.assertTitle(changes.title)
      this.props.title = changes.title
    }

    if (changes.slug !== undefined) this.props.slug = changes.slug
    if (changes.icon !== undefined) this.props.icon = changes.icon
    if (changes.description !== undefined) this.props.description = changes.description
    if (changes.position !== undefined) this.props.position = changes.position
  }

  /**
   * Re-parents the category. Returns the prefix rewrite its descendants need,
   * so the repository can move the whole subtree in one statement; returns
   * null when nothing moved.
   */
  moveTo(parent: Category | null, deepestDescendantDepth: number): PathRewrite | null {
    const newParentId = parent === null ? null : parent.id

    if (newParentId === this.props.parentId) {
      return null
    }

    if (parent !== null) {
      if (parent.id === this.id || parent.path.startsWith(this.subtreePrefix)) {
        throw new CategoryCycleError()
      }
    }

    const newPath = parent === null ? CategoryPath.root() : parent.path.childPath(parent.id)
    // The subtree keeps its shape, so the deepest node moves by the same
    // number of levels as the category itself.
    const levelsMoved = newPath.depth - this.props.path.depth

    if (deepestDescendantDepth + levelsMoved > MAX_CATEGORY_DEPTH) {
      throw new CategoryTooDeepError()
    }

    const oldPrefix = this.subtreePrefix
    this.props.parentId = newParentId
    this.props.path = newPath
    const newPrefix = this.subtreePrefix

    this.addDomainEvent(new CategoryMovedEvent(this.id, oldPrefix, newPrefix))

    return { oldPrefix, newPrefix }
  }

  private static assertTitle(title: string): void {
    if (!title || title.trim().length < 2) {
      throw new InvalidInputError('Category title must be at least 2 characters long')
    }
  }

  get title(): string {
    return this.props.title
  }

  get slug(): Slug {
    return this.props.slug
  }

  get icon(): string | null {
    return this.props.icon
  }

  get description(): string | null {
    return this.props.description
  }

  get parentId(): number | null {
    return this.props.parentId
  }

  get path(): CategoryPath {
    return this.props.path
  }

  get depth(): number {
    return this.props.path.depth
  }

  get position(): number {
    return this.props.position
  }

  /** Matches this category's descendants in a prefix query. */
  get subtreePrefix(): string {
    return this.props.path.subtreePrefix(this.id)
  }
}

export interface PathRewrite {
  oldPrefix: string
  newPrefix: string
}
