import { Inject, Injectable } from '@nestjs/common'
import {
  ADDRESS_READ_MODEL,
  AddressReadModel,
} from '@modules/addressing/application/ports/address-read.port'
import { AddressView } from '@modules/addressing/application/dto/views'
import { AddressNotFoundError } from '@modules/addressing/domain/errors/addressing.errors'
import {
  ADDRESS_REPOSITORY,
  AddressRepository,
} from '@modules/addressing/domain/repositories/address.repository'
import {
  SELLABLE_VARIANT_LOOKUP,
  SellableVariantLookup,
} from '@modules/catalog/application/ports/sellable-variant.port'
import { Money } from '@shared/domain/value-objects/money'
import {
  AppliedPromotion,
  ChosenPromotion,
  PROMOTION_ENGINE,
  PromotionEngine,
} from '@modules/promotions/application/promotion.ports'
import { allocate } from '@modules/promotions/domain/allocate'
import { PricedLine } from '@modules/promotions/domain/promotion.entity'
import {
  STORE_SETTINGS,
  StoreSettingsRepository,
} from '@modules/store/application/store-settings.port'
import { vatOn } from '@modules/store/domain/store-settings'
import { OrderDiscount, OrderShipping } from '../../domain/entities/order.aggregate'
import { OrderItem } from '../../domain/entities/order-item.entity'
import { ShippingMethod } from '../../domain/entities/shipping-method.entity'
import {
  BasketNotReadyError,
  InsufficientStockForOrderError,
  ShippingMethodNotOfferedError,
  ShippingUnavailableError,
} from '../../domain/errors/ordering.errors'
import {
  SHIPPING_METHOD_REPOSITORY,
  ShippingMethodRepository,
} from '../../domain/repositories/shipping-method.repository'

export interface CheckoutLines {
  /** Lines priced before any discount, VAT on the full line. */
  items: OrderItem[]
  /** Total parcel weight across all units. */
  weightGrams: number
  /** VAT rate applied to the lines, in basis points. */
  taxRateBp: number
  /** Category and brand of each line, same order as items, for promotion scope. */
  promotionLines: PricedLine[]
  /** Whether each line is VAT exempt, same order as items. */
  taxExempt: boolean[]
}

export interface DiscountedLines {
  items: OrderItem[]
  discount: OrderDiscount
}

export interface ShippingQuote {
  method: ShippingMethod
  fee: Money
}

export interface ShippingQuotes {
  /** Methods that deliver to the address, cheapest first. */
  options: ShippingQuote[]
  /** The requested method, else the cheapest; null when the store has no methods at all. */
  selected: ShippingQuote | null
}

/**
 * Shared address, line and shipping assembly for preview and place-order.
 */
@Injectable()
export class CheckoutAssembler {
  constructor(
    @Inject(ADDRESS_REPOSITORY) private readonly addresses: AddressRepository,
    @Inject(ADDRESS_READ_MODEL) private readonly addressReads: AddressReadModel,
    @Inject(SELLABLE_VARIANT_LOOKUP) private readonly variants: SellableVariantLookup,
    @Inject(SHIPPING_METHOD_REPOSITORY) private readonly shippingMethods: ShippingMethodRepository,
    @Inject(STORE_SETTINGS) private readonly settings: StoreSettingsRepository,
    @Inject(PROMOTION_ENGINE) private readonly promotions: PromotionEngine
  ) {}

  async requireOwnedAddress(userId: number, addressId: number): Promise<AddressView> {
    const address = await this.addresses.findById(addressId)
    if (!address) {
      throw new AddressNotFoundError(addressId)
    }
    address.ensureOwnedBy(userId)

    const view = await this.addressReads.findById(addressId)
    if (!view) {
      throw new AddressNotFoundError(addressId)
    }
    return view
  }

  async buildItems(
    lines: ReadonlyArray<{ variantId: number; quantity: number }>
  ): Promise<CheckoutLines> {
    const items: OrderItem[] = []
    const promotionLines: PricedLine[] = []
    const taxExempt: boolean[] = []
    let weightGrams = 0
    const { vatRateBp: taxRateBp } = await this.settings.get()

    for (const line of lines) {
      const sellable = await this.variants.findById(line.variantId)
      if (!sellable || !sellable.productPublished || !sellable.isActive) {
        throw new BasketNotReadyError({ variantId: line.variantId, reason: 'not_sellable' })
      }
      if (line.quantity > sellable.availableQuantity) {
        throw new InsufficientStockForOrderError(
          line.variantId,
          sellable.availableQuantity,
          line.quantity
        )
      }

      weightGrams += sellable.weightGrams * line.quantity
      const lineTotal = sellable.unitPrice * line.quantity
      promotionLines.push({
        categoryId: sellable.categoryId,
        categoryPath: sellable.categoryPath,
        brandId: sellable.brandId,
        lineTotal,
      })
      taxExempt.push(sellable.taxExempt)
      items.push(
        OrderItem.create({
          variantId: line.variantId,
          quantity: line.quantity,
          unitPrice: Money.fromMinor(sellable.unitPrice),
          taxAmount: Money.fromMinor(sellable.taxExempt ? 0 : vatOn(lineTotal, taxRateBp)),
          snapshot: {
            productId: sellable.productId,
            variantId: sellable.variantId,
            title: sellable.productTitle,
            slug: sellable.productSlug,
            sku: sellable.sku,
            options: sellable.options,
            image: sellable.image,
            thumbnail: sellable.thumbnail,
          },
        })
      )
    }

    return { items, weightGrams, taxRateBp, promotionLines, taxExempt }
  }

  /** The coupon or the best campaign for this basket, never both. */
  choosePromotion(input: {
    userId: number
    couponCode?: string | null
    lines: CheckoutLines
    shippingFee: number
    now: Date
  }): Promise<ChosenPromotion> {
    return this.promotions.choose({
      userId: input.userId,
      couponCode: input.couponCode,
      lines: input.lines.promotionLines,
      shippingFee: input.shippingFee,
      now: input.now,
    })
  }

  /** Records the promotion against the order; inside the order transaction. */
  redeemPromotion(
    applied: AppliedPromotion,
    input: { orderId: number; userId: number; now: Date },
    tx: unknown
  ): Promise<void> {
    return this.promotions.redeem(applied, input, tx)
  }

  /**
   * Spreads the goods discount over the eligible lines in proportion to their
   * value and charges VAT on what is left of each line.
   */
  static applyDiscount(lines: CheckoutLines, applied: AppliedPromotion | null): DiscountedLines {
    if (!applied) {
      return { items: lines.items, discount: { total: Money.zero, promotion: null } }
    }

    const { goods, shipping, eligible } = applied.discount
    const shares = allocate(
      goods,
      lines.items.map((item, index) => (eligible[index] ? item.lineTotal.amount : 0))
    )
    const items = lines.items.map((item, index) => {
      const discountAmount = shares[index]
      const taxable = item.lineTotal.amount - discountAmount
      return OrderItem.create({
        variantId: item.variantId as number,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        snapshot: item.productSnapshot,
        discountAmount: Money.fromMinor(discountAmount),
        taxAmount: Money.fromMinor(lines.taxExempt[index] ? 0 : vatOn(taxable, lines.taxRateBp)),
      })
    })

    return {
      items,
      discount: { total: Money.fromMinor(goods + shipping), promotion: applied.promotion },
    }
  }

  /**
   * Quotes every active method for the address. A store with no methods at
   * all ships for free (no selection); a store whose methods all skip this
   * province cannot take the order.
   */
  async quoteShipping(input: {
    provinceId: number
    subtotal: Money
    weightGrams: number
    shippingMethodId?: number | null
  }): Promise<ShippingQuotes> {
    const active = await this.shippingMethods.listActive()
    if (active.length === 0) {
      return { options: [], selected: null }
    }

    const options = active
      .filter((method) => method.servesProvince(input.provinceId))
      .map((method) => ({
        method,
        fee: method.quote({ weightGrams: input.weightGrams, subtotal: input.subtotal }),
      }))
      .sort((a, b) => a.fee.amount - b.fee.amount || a.method.position - b.method.position)

    if (options.length === 0) {
      throw new ShippingUnavailableError(input.provinceId)
    }

    if (input.shippingMethodId === undefined || input.shippingMethodId === null) {
      return { options, selected: options[0] }
    }

    const selected = options.find((option) => option.method.id === input.shippingMethodId)
    if (!selected) {
      throw new ShippingMethodNotOfferedError(input.shippingMethodId, input.provinceId)
    }
    return { options, selected }
  }

  static toOrderShipping(selected: ShippingQuote | null, weightGrams: number): OrderShipping {
    return selected
      ? { method: selected.method.toSnapshot(), fee: selected.fee, weightGrams }
      : { method: null, fee: Money.zero, weightGrams }
  }
}
