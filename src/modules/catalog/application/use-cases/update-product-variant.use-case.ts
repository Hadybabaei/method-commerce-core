import { Inject, Injectable } from '@nestjs/common'
import { UseCase } from '@shared/application/use-case'
import { Money } from '@shared/domain/value-objects/money'
import { ProductNotFoundError, SkuAlreadyTakenError } from '../../domain/errors/catalog.errors'
import { PRODUCT_REPOSITORY, ProductRepository } from '../../domain/repositories/product.repository'
import { Sku } from '../../domain/value-objects/sku.vo'
import { UpdateProductVariantCommand } from '../dto/commands'
import { ProductDetailView } from '../dto/views'
import { INVENTORY_STOCK_WRITER, InventoryStockWriter } from '../ports/inventory-stock.port'
import { PRODUCT_READ_MODEL, ProductReadModel } from '../ports/product-read.port'

@Injectable()
export class UpdateProductVariantUseCase
  implements UseCase<UpdateProductVariantCommand, ProductDetailView>
{
  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepository,
    @Inject(PRODUCT_READ_MODEL) private readonly productReads: ProductReadModel,
    @Inject(INVENTORY_STOCK_WRITER) private readonly inventory: InventoryStockWriter
  ) {}

  async execute(command: UpdateProductVariantCommand): Promise<ProductDetailView> {
    const product = await this.products.findById(command.productId)

    if (!product) {
      throw new ProductNotFoundError(command.productId)
    }

    const variant = product.requireVariant(command.variantId)
    let productChanged = false

    if (command.sku !== undefined) {
      const sku = Sku.create(command.sku)

      if (await this.products.existsBySku(sku.value, variant.id)) {
        throw new SkuAlreadyTakenError(sku.value)
      }

      product.changeVariantSku(variant.id, sku)
      productChanged = true
    }

    if (command.price !== undefined || command.salePrice !== undefined) {
      variant.changePricing({
        price: command.price === undefined ? undefined : Money.fromMinor(command.price),
        salePrice:
          command.salePrice === undefined
            ? undefined
            : command.salePrice === null
              ? null
              : Money.fromMinor(command.salePrice),
      })
      productChanged = true
    }

    if (command.weightGrams !== undefined) {
      variant.setWeight(command.weightGrams)
      productChanged = true
    }

    if (command.image !== undefined) {
      variant.setImage(command.image)
      productChanged = true
    }

    if (command.isActive === true) {
      variant.activate()
      productChanged = true
    }

    if (command.isActive === false) {
      variant.deactivate()
      productChanged = true
    }

    if (productChanged) {
      await this.products.save(product)
    }

    if (command.onHand !== undefined) {
      await this.inventory.setOnHand({
        variantId: variant.id,
        onHand: command.onHand,
      })
    }

    const view = await this.productReads.findDetailById(product.id)

    if (!view) {
      throw new ProductNotFoundError(product.id)
    }

    return view
  }
}
