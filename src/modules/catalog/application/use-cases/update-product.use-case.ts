import { Inject, Injectable } from '@nestjs/common'
import { UseCase } from '@shared/application/use-case'
import { ProductChanges } from '../../domain/entities/product.aggregate'
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
import { UpdateProductCommand } from '../dto/commands'
import { ProductDetailView } from '../dto/views'
import { toProductImages } from '../mappers/product-image.mapper'
import { PRODUCT_READ_MODEL, ProductReadModel } from '../ports/product-read.port'

@Injectable()
export class UpdateProductUseCase implements UseCase<UpdateProductCommand, ProductDetailView> {
  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepository,
    @Inject(PRODUCT_READ_MODEL) private readonly productReads: ProductReadModel,
    @Inject(CATEGORY_REPOSITORY) private readonly categories: CategoryRepository,
    @Inject(BRAND_REPOSITORY) private readonly brands: BrandRepository
  ) {}

  async execute(command: UpdateProductCommand): Promise<ProductDetailView> {
    const product = await this.products.findById(command.productId)

    if (!product) {
      throw new ProductNotFoundError(command.productId)
    }

    product.apply(await this.toChanges(command, product.id))

    if (command.images !== undefined) {
      product.replaceImages(toProductImages(command.images))
    }

    if (command.published === true) product.publish()
    if (command.published === false) product.unpublish()

    const saved = await this.products.save(product)
    const view = await this.productReads.findDetailById(saved.id)

    if (!view) {
      throw new ProductNotFoundError(saved.id)
    }

    return view
  }

  private async toChanges(
    command: UpdateProductCommand,
    productId: number
  ): Promise<ProductChanges> {
    const changes: ProductChanges = {}

    if (command.title !== undefined) changes.title = command.title
    if (command.subTitle !== undefined) changes.subTitle = command.subTitle
    if (command.description !== undefined) changes.description = command.description
    if (command.shortDescription !== undefined) {
      changes.shortDescription = command.shortDescription
    }
    if (command.weightGrams !== undefined) changes.weightGrams = command.weightGrams

    if (command.slug !== undefined) {
      const slug = Slug.create(command.slug)

      if (await this.products.existsBySlug(slug.value, productId)) {
        throw new SlugAlreadyTakenError(slug.value)
      }

      changes.slug = slug
    }

    if (command.categoryId !== undefined) {
      if (command.categoryId !== null && !(await this.categories.findById(command.categoryId))) {
        throw new CategoryNotFoundError(command.categoryId)
      }

      changes.categoryId = command.categoryId
    }

    if (command.brandId !== undefined) {
      if (command.brandId !== null && !(await this.brands.findById(command.brandId))) {
        throw new BrandNotFoundError(command.brandId)
      }

      changes.brandId = command.brandId
    }

    return changes
  }
}
