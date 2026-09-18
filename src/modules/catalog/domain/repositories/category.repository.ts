import { Category, PathRewrite } from '../entities/category.aggregate'

export interface CategoryRepository {
  findById(id: number): Promise<Category | null>
  findBySlug(slug: string): Promise<Category | null>
  /** Whole tree in sibling order, used to build the nested view. */
  findAll(): Promise<Category[]>
  /** The category itself plus every category beneath it. */
  findSubtreeIds(category: Category): Promise<number[]>
  /** Depth of the deepest node under this category; its own depth when empty. */
  findDeepestDescendantDepth(category: Category): Promise<number>
  countChildren(id: number): Promise<number>
  countProducts(id: number): Promise<number>
  existsBySlug(slug: string, excludeId?: number): Promise<boolean>
  /**
   * Saves the category and, when it was re-parented, rewrites the stored paths
   * of its descendants in the same transaction.
   */
  save(category: Category, pathRewrite?: PathRewrite | null): Promise<Category>
  delete(id: number): Promise<void>
}

export const CATEGORY_REPOSITORY = Symbol('CategoryRepository')
