import { Inject, Injectable } from '@nestjs/common'
import {
  SELLABLE_VARIANT_LOOKUP,
  SellableVariantLookup,
  SellableVariantSnapshot,
} from '@modules/catalog/application/ports/sellable-variant.port'
import { PrismaService } from '@shared/infrastructure/persistence/prisma/prisma.service'
import { Basket } from '../../domain/entities/basket.aggregate'
import {
  BasketNotFoundError,
  InsufficientStockError,
  VariantNotSellableError,
} from '../../domain/errors/basket.errors'
import { BASKET_REPOSITORY, BasketRepository } from '../../domain/repositories/basket.repository'

/**
 * Shared write-side helpers: open (or create) the customer's basket, and make
 * sure a variant is something they are allowed to buy at the requested qty.
 */
@Injectable()
export class BasketWriter {
  constructor(
    @Inject(BASKET_REPOSITORY) private readonly baskets: BasketRepository,
    @Inject(SELLABLE_VARIANT_LOOKUP) private readonly variants: SellableVariantLookup,
    private readonly prisma: PrismaService
  ) {}

  async getOrCreate(userId: number): Promise<Basket> {
    const existing = await this.baskets.findByUserId(userId)
    if (existing) {
      return existing
    }

    return this.baskets.save(Basket.create(userId))
  }

  /**
   * Mutate the basket under `FOR UPDATE` so a concurrent checkout cannot
   * clear lines that this request still thinks it owns.
   */
  async mutate(userId: number, mutate: (basket: Basket) => Promise<void> | void): Promise<Basket> {
    return this.prisma.$transaction(async (tx) => {
      let basket = await this.baskets.lockByUserId(userId, tx)
      if (!basket) {
        await this.baskets.save(Basket.create(userId), tx)
        basket = await this.baskets.lockByUserId(userId, tx)
        if (!basket) {
          throw new BasketNotFoundError(userId)
        }
      }

      await mutate(basket)
      return this.baskets.save(basket, tx)
    })
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
