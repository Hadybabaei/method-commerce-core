import { Inject, Injectable } from '@nestjs/common'
import { InvalidInputError, NotFoundError } from '@shared/domain/errors'
import {
  BOUGHT_TOGETHER_READ_MODEL,
  BoughtTogetherReadModel,
  ProductDocument,
  ProductSearchResult,
  SEARCH_ENGINE,
  SearchEngine,
  SearchFacets,
  SearchSort,
} from './search.ports'

/** Resolves storefront slugs to ids for search filters. */
export interface CatalogLookup {
  categoryIdBySlug(slug: string): Promise<number | null>
  brandIdsBySlugs(slugs: string[]): Promise<number[]>
  productBySlug(
    slug: string
  ): Promise<{ id: number; categoryId: number | null; brandId: number | null } | null>
}

export const CATALOG_LOOKUP = Symbol('CatalogLookup')

/** A product card as search returns it. */
export interface SearchHitView {
  id: number
  title: string
  subTitle: string | null
  slug: string
  thumbnail: string | null
  category: { id: number; title: string; slug: string } | null
  brand: { id: number; title: string; slug: string } | null
  priceFrom: number | null
  priceTo: number | null
  inStock: boolean
  /** Null until someone rates the product. */
  rating: { average: number; count: number } | null
  createdAt: Date
}

export interface SearchResultView {
  items: SearchHitView[]
  total: number
  limit: number
  offset: number
  facets: SearchFacets
}

export function toHit(document: ProductDocument): SearchHitView {
  return {
    id: document.id,
    title: document.title,
    subTitle: document.subTitle,
    slug: document.slug,
    thumbnail: document.thumbnail,
    category: document.category,
    brand: document.brand,
    priceFrom: document.priceFrom,
    priceTo: document.priceTo,
    inStock: document.inStock,
    rating:
      document.ratingCount > 0
        ? { average: document.ratingAverage, count: document.ratingCount }
        : null,
    createdAt: new Date(document.createdAt),
  }
}

const toView = (result: ProductSearchResult): SearchResultView => ({
  ...result,
  items: result.items.map(toHit),
})

export interface SearchProductsInput {
  q?: string
  categoryId?: number
  categorySlug?: string
  brandIds?: number[]
  brandSlugs?: string[]
  /** "name:value" pairs. */
  options?: string[]
  priceMin?: number
  priceMax?: number
  inStockOnly?: boolean
  sort?: SearchSort
  limit?: number
  offset?: number
}

/** "رنگ:قرمز" pairs → { رنگ: ["قرمز"] }. */
export function groupOptions(pairs: string[] = []): Record<string, string[]> {
  const grouped: Record<string, string[]> = {}
  for (const pair of pairs) {
    const colon = pair.indexOf(':')
    if (colon <= 0 || colon === pair.length - 1)
      throw new InvalidInputError('Options look like name:value', { pair })
    const name = pair.slice(0, colon).trim()
    const value = pair.slice(colon + 1).trim()
    grouped[name] = [...new Set([...(grouped[name] ?? []), value])]
  }
  return grouped
}

@Injectable()
export class SearchProductsUseCase {
  constructor(
    @Inject(SEARCH_ENGINE) private readonly engine: SearchEngine,
    @Inject(CATALOG_LOOKUP) private readonly lookup: CatalogLookup
  ) {}

  async execute(input: SearchProductsInput): Promise<SearchResultView> {
    if (
      input.priceMin !== undefined &&
      input.priceMax !== undefined &&
      input.priceMin > input.priceMax
    ) {
      throw new InvalidInputError('price_min cannot be greater than price_max')
    }
    let categoryId = input.categoryId
    if (input.categorySlug) {
      const id = await this.lookup.categoryIdBySlug(input.categorySlug)
      if (id === null) throw new NotFoundError('Category not found', { slug: input.categorySlug })
      categoryId = id
    }
    let brandIds = input.brandIds ?? []
    if (input.brandSlugs?.length) {
      const resolved = await this.lookup.brandIdsBySlugs(input.brandSlugs)
      if (resolved.length === 0)
        throw new NotFoundError('Brand not found', { slugs: input.brandSlugs })
      brandIds = [...new Set([...brandIds, ...resolved])]
    }
    const q = input.q?.trim() || undefined
    const result = await this.engine.search({
      q,
      categoryId,
      brandIds,
      options: groupOptions(input.options),
      priceMin: input.priceMin,
      priceMax: input.priceMax,
      inStockOnly: input.inStockOnly,
      // Without words there is nothing to rank by relevance; show the newest.
      sort: input.sort ?? (q ? 'relevance' : 'newest'),
      limit: Math.min(Math.max(input.limit ?? 24, 1), 100),
      offset: Math.max(input.offset ?? 0, 0),
    })
    return toView(result)
  }
}

export interface SuggestionsView {
  products: Pick<SearchHitView, 'id' | 'title' | 'slug' | 'thumbnail' | 'priceFrom'>[]
  categories: { id: number; title: string; count: number }[]
}

@Injectable()
export class SuggestUseCase {
  constructor(@Inject(SEARCH_ENGINE) private readonly engine: SearchEngine) {}

  async execute(q: string): Promise<SuggestionsView> {
    const text = q.trim()
    if (text.length < 2) return { products: [], categories: [] }
    const result = await this.engine.search({ q: text, sort: 'relevance', limit: 6, offset: 0 })
    return {
      products: result.items.map(({ id, title, slug, thumbnail, priceFrom }) => ({
        id,
        title,
        slug,
        thumbnail,
        priceFrom,
      })),
      categories: result.facets.categories
        .slice(0, 3)
        .map(({ value, label, count }) => ({ id: value, title: label, count })),
    }
  }
}

@Injectable()
export class RecommendationsUseCase {
  constructor(
    @Inject(SEARCH_ENGINE) private readonly engine: SearchEngine,
    @Inject(CATALOG_LOOKUP) private readonly lookup: CatalogLookup,
    @Inject(BOUGHT_TOGETHER_READ_MODEL) private readonly together: BoughtTogetherReadModel
  ) {}

  /** Best sellers from the same category, topped up from the same brand. */
  async related(slug: string, limit: number): Promise<SearchHitView[]> {
    const product = await this.product(slug)
    const base = {
      sort: 'best_selling' as const,
      offset: 0,
      excludeIds: [product.id],
      inStockOnly: true,
    }
    const picked: ProductDocument[] = []
    if (product.categoryId !== null) {
      picked.push(
        ...(await this.engine.search({ ...base, categoryId: product.categoryId, limit })).items
      )
    }
    if (picked.length < limit && product.brandId !== null) {
      const more = await this.engine.search({
        ...base,
        brandIds: [product.brandId],
        excludeIds: [product.id, ...picked.map((document) => document.id)],
        limit: limit - picked.length,
      })
      picked.push(...more.items)
    }
    return picked.map(toHit)
  }

  /** Products that shared an order with this one most often, still published and in stock. */
  async boughtTogether(slug: string, limit: number): Promise<SearchHitView[]> {
    const product = await this.product(slug)
    const ids = await this.together.productIds(product.id, limit * 3)
    if (ids.length === 0) return []
    const found = await this.engine.search({
      sort: 'relevance',
      onlyIds: ids,
      inStockOnly: true,
      limit: ids.length,
      offset: 0,
    })
    const byId = new Map(found.items.map((document) => [document.id, document]))
    // Keep the co-purchase order, not the engine's.
    return ids
      .map((id) => byId.get(id))
      .filter((document): document is ProductDocument => document !== undefined)
      .slice(0, limit)
      .map(toHit)
  }

  private async product(slug: string) {
    const product = await this.lookup.productBySlug(slug)
    if (!product) throw new NotFoundError('Product not found', { slug })
    return product
  }
}
