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
import { OrderItem } from '../../domain/entities/order-item.entity'
import {
  BasketNotReadyError,
  InsufficientStockForOrderError,
} from '../../domain/errors/ordering.errors'

export const CHECKOUT_SHIPPING_FEE_RIAL = 0

/**
 * Shared address + line assembly for preview and place-order.
 */
@Injectable()
export class CheckoutAssembler {
  constructor(
    @Inject(ADDRESS_REPOSITORY) private readonly addresses: AddressRepository,
    @Inject(ADDRESS_READ_MODEL) private readonly addressReads: AddressReadModel,
    @Inject(SELLABLE_VARIANT_LOOKUP) private readonly variants: SellableVariantLookup
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
  ): Promise<OrderItem[]> {
    const orderItems: OrderItem[] = []

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

      orderItems.push(
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

    return orderItems
  }
}
