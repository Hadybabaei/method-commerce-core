import { PaginatedView, ProductDetailView, ProductSummaryView } from '../dto/views'
import { ProductSort } from '../dto/commands'

export interface ProductListCriteria {
  productId?: number
  /** Already expanded to the category and all of its descendants. */
  categoryIds?: number[]
  brandId?: number
  title?: string
  search?: string
  priceMin?: number
  priceMax?: number
  quantityMin?: number
  publishedOnly: boolean
  sort: ProductSort
  limit: number
  offset: number
}

/**
 * Read side of the catalog.
 *
 * Listing joins category, brand and images for every row, which an aggregate
 * repository has no business doing; keeping it behind its own port stops the
 * write model from growing query options it does not need.
 */
export interface ProductReadModel {
  list(criteria: ProductListCriteria): Promise<PaginatedView<ProductSummaryView>>
  findDetailById(id: number): Promise<ProductDetailView | null>
  findDetailBySlug(slug: string, publishedOnly: boolean): Promise<ProductDetailView | null>
}

export const PRODUCT_READ_MODEL = Symbol('ProductReadModel')
