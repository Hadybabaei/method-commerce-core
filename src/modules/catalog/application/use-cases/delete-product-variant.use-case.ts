import { Inject, Injectable } from '@nestjs/common'
import { UseCase } from '@shared/application/use-case'
import { ProductNotFoundError } from '../../domain/errors/catalog.errors'
import { PRODUCT_REPOSITORY, ProductRepository } from '../../domain/repositories/product.repository'
import { DeleteProductVariantCommand } from '../dto/commands'
import { ProductDetailView } from '../dto/views'
import { PRODUCT_READ_MODEL, ProductReadModel } from '../ports/product-read.port'

@Injectable()
export class DeleteProductVariantUseCase
  implements UseCase<DeleteProductVariantCommand, ProductDetailView>
{
  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepository,
    @Inject(PRODUCT_READ_MODEL) private readonly productReads: ProductReadModel
  ) {}

  async execute(command: DeleteProductVariantCommand): Promise<ProductDetailView> {
    const product = await this.products.findById(command.productId)

    if (!product) {
      throw new ProductNotFoundError(command.productId)
    }

    product.removeVariantById(command.variantId)
    const saved = await this.products.save(product)
    const view = await this.productReads.findDetailById(saved.id)

    if (!view) {
      throw new ProductNotFoundError(saved.id)
    }

    return view
  }
}
