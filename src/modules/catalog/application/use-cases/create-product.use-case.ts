import { Inject, Injectable } from '@nestjs/common'
import { UseCase } from '@shared/application/use-case'
import { Product } from '../../domain/entities/product.aggregate'
import {
  BrandNotFoundError,
  CategoryNotFoundError,
  ProductNotFoundError,
  SlugAlreadyTakenError,
} from '../../domain/errors/catalog.errors'
import { BRAND_REPOSITORY, BrandRepository } from '../../domain/repositories/brand.repository'
import {
  CATEGORY_REPOSITORY,
  CategoryRepository,
} from '../../domain/repositories/category.repository'
import { PRODUCT_REPOSITORY, ProductRepository } from '../../domain/repositories/product.repository'
import { Slug } from '../../domain/value-objects/slug.vo'
import { CreateProductCommand, ProductImageCommand } from '../dto/commands'
import { ProductDetailView } from '../dto/views'
import { PRODUCT_READ_MODEL, ProductReadModel } from '../ports/product-read.port'
import { toProductImages } from '../mappers/product-image.mapper'

const DEFAULT_WEIGHT_GRAMS = 500

@Injectable()
export class CreateProductUseCase implements UseCase<CreateProductCommand, ProductDetailView> {
  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepository,
    @Inject(PRODUCT_READ_MODEL) private readonly productReads: ProductReadModel,
    @Inject(CATEGORY_REPOSITORY) private readonly categories: CategoryRepository,
    @Inject(BRAND_REPOSITORY) private readonly brands: BrandRepository
  ) {}

  async execute(command: CreateProductCommand): Promise<ProductDetailView> {
    const slug = Slug.create(command.slug ?? command.title)

    if (await this.products.existsBySlug(slug.value)) {
      throw new SlugAlreadyTakenError(slug.value)
    }

    await this.assertCategoryExists(command.categoryId)
    await this.assertBrandExists(command.brandId)

    const product = Product.create({
      title: command.title,
      slug,
      subTitle: command.subTitle ?? null,
      description: command.description ?? null,
      shortDescription: command.shortDescription ?? null,
      published: command.published ?? false,
      weightGrams: command.weightGrams ?? DEFAULT_WEIGHT_GRAMS,
      categoryId: command.categoryId ?? null,
      brandId: command.brandId ?? null,
      images: toProductImages(command.images as ProductImageCommand[] | undefined),
    })

    const saved = await this.products.save(product)
    const view = await this.productReads.findDetailById(saved.id)

    if (!view) {
      throw new ProductNotFoundError(saved.id)
    }

    return view
  }

  private async assertCategoryExists(categoryId?: number | null): Promise<void> {
    if (categoryId === undefined || categoryId === null) {
      return
    }

    if (!(await this.categories.findById(categoryId))) {
      throw new CategoryNotFoundError(categoryId)
    }
  }

  private async assertBrandExists(brandId?: number | null): Promise<void> {
    if (brandId === undefined || brandId === null) {
      return
    }

    if (!(await this.brands.findById(brandId))) {
      throw new BrandNotFoundError(brandId)
    }
  }
}
