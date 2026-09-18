import { Inject, Injectable } from '@nestjs/common'
import {
  SELLABLE_VARIANT_LOOKUP,
  SellableVariantLookup,
  SellableVariantSnapshot,
} from '@modules/catalog/application/ports/sellable-variant.port'
import { Basket } from '../../domain/entities/basket.aggregate'
import { InsufficientStockError, VariantNotSellableError } from '../../domain/errors/basket.errors'
import { BASKET_REPOSITORY, BasketRepository } from '../../domain/repositories/basket.repository'

/**
 * Shared write-side helpers: open (or create) the customer's basket, and make
 * sure a variant is something they are allowed to buy at the requested qty.
 */
@Injectable()
export class BasketWriter {
  constructor(
    @Inject(BASKET_REPOSITORY) private readonly baskets: BasketRepository,
    @Inject(SELLABLE_VARIANT_LOOKUP) private readonly variants: SellableVariantLookup
  ) {}

  async getOrCreate(userId: number): Promise<Basket> {
    const existing = await this.baskets.findByUserId(userId)
    if (existing) {
      return existing
    }

    return this.baskets.save(Basket.create(userId))
  }

  async requireSellable(
    variantId: number,
    requestedQuantity: number
  ): Promise<SellableVariantSnapshot> {
    const variant = await this.variants.findById(variantId)

    if (!variant || !variant.productPublished || !variant.isActive) {
      throw new VariantNotSellableError(variantId)
    }

    if (requestedQuantity > variant.availableQuantity) {
      throw new InsufficientStockError(variantId, variant.availableQuantity, requestedQuantity)
    }

    return variant
  }
}
