import { Inject, Injectable } from '@nestjs/common'
import { UseCase } from '@shared/application/use-case'
import { InvalidInputError } from '@shared/domain/errors'
import { Category } from '../../domain/entities/category.aggregate'
import { BrandNotFoundError, CategoryNotFoundError } from '../../domain/errors/catalog.errors'
import { BRAND_REPOSITORY, BrandRepository } from '../../domain/repositories/brand.repository'
import {
  CATEGORY_REPOSITORY,
  CategoryRepository,
} from '../../domain/repositories/category.repository'
import { ListProductsQuery } from '../dto/commands'
import { PaginatedView, ProductSummaryView } from '../dto/views'
import { PRODUCT_READ_MODEL, ProductReadModel } from '../ports/product-read.port'

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

@Injectable()
export class ListProductsUseCase implements UseCase<
  ListProductsQuery,
  PaginatedView<ProductSummaryView>
> {
  constructor(
    @Inject(PRODUCT_READ_MODEL) private readonly productReads: ProductReadModel,
    @Inject(CATEGORY_REPOSITORY) private readonly categories: CategoryRepository,
    @Inject(BRAND_REPOSITORY) private readonly brands: BrandRepository
  ) {}

  async execute(query: ListProductsQuery): Promise<PaginatedView<ProductSummaryView>> {
    this.assertPriceRange(query)

    const [categoryIds, brandId] = await Promise.all([
      this.resolveCategoryIds(query),
      this.resolveBrandId(query),
    ])

    return this.productReads.list({
      productId: query.productId,
      categoryIds,
      brandId,
      title: query.title?.trim() || undefined,
      search: query.search?.trim() || undefined,
      priceMin: query.priceMin,
      priceMax: query.priceMax,
      quantityMin: query.quantityMin,
      publishedOnly: query.publishedOnly ?? true,
      sort: query.sort ?? 'newest',
      limit: Math.min(Math.max(query.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT),
      offset: Math.max(query.offset ?? 0, 0),
    })
  }

  private assertPriceRange(query: ListProductsQuery): void {
    if (
      query.priceMin !== undefined &&
      query.priceMax !== undefined &&
      query.priceMin > query.priceMax
    ) {
      throw new InvalidInputError('price_min cannot be greater than price_max')
    }
  }

  /**
   * Filtering by a category includes everything below it, which the
   * materialized path answers in a single query.
   */
  private async resolveCategoryIds(query: ListProductsQuery): Promise<number[] | undefined> {
    const category = await this.resolveCategory(query)

    if (!category) {
      return undefined
    }

    return this.categories.findSubtreeIds(category)
  }

  private async resolveCategory(query: ListProductsQuery): Promise<Category | null> {
    if (query.categorySlug) {
      const category = await this.categories.findBySlug(query.categorySlug)

      if (!category) {
        throw new CategoryNotFoundError(query.categorySlug)
      }

      return category
    }

    if (query.categoryId !== undefined) {
      const category = await this.categories.findById(query.categoryId)

      if (!category) {
        throw new CategoryNotFoundError(query.categoryId)
      }

      return category
    }

    return null
  }

  private async resolveBrandId(query: ListProductsQuery): Promise<number | undefined> {
    if (query.brandSlug) {
      const brand = await this.brands.findBySlug(query.brandSlug)

      if (!brand) {
        throw new BrandNotFoundError(query.brandSlug)
      }

      return brand.id
    }

    return query.brandId
  }
}
