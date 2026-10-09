/**
 * Product search. One document per published product, flattened from the
 * catalog, inventory, comments and orders so the engine can filter, sort and
 * count facets without touching the database.
 */

export interface ProductDocument {
  id: number
  title: string
  subTitle: string | null
  slug: string
  thumbnail: string | null
  category: { id: number; title: string; slug: string } | null
  /** The category and every ancestor, so a parent category finds its children's products. */
  categoryIds: number[]
  brand: { id: number; title: string; slug: string } | null
  /** "option:value" pairs of active variants, e.g. "رنگ:قرمز". */
  options: string[]
  /** Cheapest and dearest active variant, Rial; null without an active variant. */
  priceFrom: number | null
  priceTo: number | null
  /** At least one active variant has units available. */
  inStock: boolean
  /** Average of approved root-comment ratings, 0 when unrated. */
  ratingAverage: number
  ratingCount: number
  /** Units sold in paid, uncancelled orders. */
  salesCount: number
  /** Epoch milliseconds. */
  createdAt: number
}

export const SEARCH_SORTS = [
  'relevance',
  'newest',
  'price_asc',
  'price_desc',
  'best_selling',
  'rating',
] as const
export type SearchSort = (typeof SEARCH_SORTS)[number]

export interface ProductSearchQuery {
  q?: string
  /** Expanded by the engine through `categoryIds`. */
  categoryId?: number
  brandIds?: number[]
  /** Option name → accepted values; values of one option are OR-ed, options AND-ed. */
  options?: Record<string, string[]>
  priceMin?: number
  priceMax?: number
  inStockOnly?: boolean
  /** Only these products (e.g. recommendations computed elsewhere). */
  onlyIds?: number[]
  /** Products to leave out (e.g. the one being viewed). */
  excludeIds?: number[]
  sort: SearchSort
  limit: number
  offset: number
}

export interface FacetCount<TKey> {
  value: TKey
  label: string
  count: number
}

export interface SearchFacets {
  brands: FacetCount<number>[]
  categories: FacetCount<number>[]
  /** Option name → its values with counts. */
  options: { name: string; values: FacetCount<string>[] }[]
  /** Price range of the matching products, Rial; null when nothing matches. */
  price: { min: number; max: number } | null
}

export interface ProductSearchResult {
  items: ProductDocument[]
  total: number
  limit: number
  offset: number
  facets: SearchFacets
}

export interface SearchEngine {
  search(query: ProductSearchQuery): Promise<ProductSearchResult>
  /** Adds or replaces documents. */
  upsert(documents: ProductDocument[]): Promise<void>
  remove(ids: number[]): Promise<void>
  /** Replaces the whole index with `documents`, atomically where the engine allows. */
  replaceAll(documents: ProductDocument[]): Promise<void>
  /** Whether the engine answers; used by the readiness check. */
  ping(): Promise<boolean>
}

export const SEARCH_ENGINE = Symbol('SearchEngine')

/** Builds documents from the database. */
export interface ProductDocumentSource {
  /** Published products only; unpublished or deleted ids are absent from the result. */
  byIds(ids: number[]): Promise<ProductDocument[]>
  all(): Promise<ProductDocument[]>
  /** The products owning these variants. */
  productIdsForVariants(variantIds: number[]): Promise<number[]>
}

export const PRODUCT_DOCUMENT_SOURCE = Symbol('ProductDocumentSource')

/** Products often bought in the same order as a given product, best first. */
export interface BoughtTogetherReadModel {
  productIds(productId: number, limit: number): Promise<number[]>
}

export const BOUGHT_TOGETHER_READ_MODEL = Symbol('BoughtTogetherReadModel')
