import { Inject, Injectable } from '@nestjs/common'
import { UseCase } from '@shared/application/use-case'
import { ProductNotFoundError } from '../../domain/errors/catalog.errors'
import { PRODUCT_REPOSITORY, ProductRepository } from '../../domain/repositories/product.repository'

@Injectable()
export class DeleteProductUseCase implements UseCase<number, void> {
  constructor(@Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepository) {}

  async execute(productId: number): Promise<void> {
    const product = await this.products.findById(productId)

    if (!product) {
      throw new ProductNotFoundError(productId)
    }

    await this.products.delete(productId)
  }
}
