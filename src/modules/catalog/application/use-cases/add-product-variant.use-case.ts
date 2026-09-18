import { Inject, Injectable } from '@nestjs/common'
import { UseCase } from '@shared/application/use-case'
import { Money } from '@shared/domain/value-objects/money'
import { ProductNotFoundError, SkuAlreadyTakenError } from '../../domain/errors/catalog.errors'
import { PRODUCT_REPOSITORY, ProductRepository } from '../../domain/repositories/product.repository'
import { Sku } from '../../domain/value-objects/sku.vo'
import { VariantSelection } from '../../domain/value-objects/variant-selection.vo'
import { AddProductVariantCommand } from '../dto/commands'
import { ProductDetailView } from '../dto/views'
import { INVENTORY_STOCK_WRITER, InventoryStockWriter } from '../ports/inventory-stock.port'
import { PRODUCT_READ_MODEL, ProductReadModel } from '../ports/product-read.port'

@Injectable()
export class AddProductVariantUseCase implements UseCase<AddProductVariantCommand, ProductDetailView> {
  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepository,
    @Inject(PRODUCT_READ_MODEL) private readonly productReads: ProductReadModel,
    @Inject(INVENTORY_STOCK_WRITER) private readonly inventory: InventoryStockWriter
  ) {}

  async execute(command: AddProductVariantCommand): Promise<ProductDetailView> {
    const product = await this.products.findById(command.productId)

    if (!product) {
      throw new ProductNotFoundError(command.productId)
    }

    const sku = Sku.create(command.sku)

    if (await this.products.existsBySku(sku.value)) {
      throw new SkuAlreadyTakenError(sku.value)
    }

    product.addVariant({
      sku,
      selection: VariantSelection.create(command.options ?? []),
      price: Money.fromMinor(command.price),
      salePrice: command.salePrice === undefined || command.salePrice === null
        ? null
        : Money.fromMinor(command.salePrice),
      weightGrams: command.weightGrams ?? null,
      image: command.image ?? null,
      isActive: command.isActive ?? true,
    })

    const saved = await this.products.save(product)
    const variant = saved.findVariantBySku(sku.value)

    if (!variant) {
      throw new ProductNotFoundError(saved.id)
    }

    await this.inventory.setOnHand({
      variantId: variant.id,
      onHand: command.onHand ?? 0,
    })

    const view = await this.productReads.findDetailById(saved.id)

    if (!view) {
      throw new ProductNotFoundError(saved.id)
    }

    return view
  }
}
