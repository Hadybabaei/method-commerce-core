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
import { OrderShipping } from '../../domain/entities/order.aggregate'
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
  items: OrderItem[]
  /** Total parcel weight across all units. */
  weightGrams: number
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
    @Inject(SHIPPING_METHOD_REPOSITORY) private readonly shippingMethods: ShippingMethodRepository
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
    let weightGrams = 0

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
      items.push(
        OrderItem.create({
          variantId: line.variantId,
          quantity: line.quantity,
          unitPrice: Money.fromMinor(sellable.unitPrice),
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

    return { items, weightGrams }
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
