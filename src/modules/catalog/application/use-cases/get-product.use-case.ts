import { Inject, Injectable } from '@nestjs/common'
import { UseCase } from '@shared/application/use-case'
import { ProductNotFoundError } from '../../domain/errors/catalog.errors'
import { ProductDetailView } from '../dto/views'
import { PRODUCT_READ_MODEL, ProductReadModel } from '../ports/product-read.port'

export interface GetProductQuery {
  slug: string
  /** The storefront only ever sees published products; the panel sees drafts. */
  publishedOnly: boolean
}

@Injectable()
export class GetProductBySlugUseCase implements UseCase<GetProductQuery, ProductDetailView> {
  constructor(@Inject(PRODUCT_READ_MODEL) private readonly productReads: ProductReadModel) {}

  async execute(query: GetProductQuery): Promise<ProductDetailView> {
    const product = await this.productReads.findDetailBySlug(query.slug, query.publishedOnly)

    if (!product) {
      throw new ProductNotFoundError(query.slug)
    }

    return product
  }
}

/** The panel addresses products by id, since a draft's slug may still change. */
@Injectable()
export class GetProductByIdUseCase implements UseCase<number, ProductDetailView> {
  constructor(@Inject(PRODUCT_READ_MODEL) private readonly productReads: ProductReadModel) {}

  async execute(productId: number): Promise<ProductDetailView> {
    const product = await this.productReads.findDetailById(productId)

    if (!product) {
      throw new ProductNotFoundError(productId)
    }

    return product
  }
}
