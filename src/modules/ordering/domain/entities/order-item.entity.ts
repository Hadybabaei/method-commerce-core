import { Money } from '@shared/domain/value-objects/money'

export interface OrderProductSnapshot {
  productId: number
  variantId: number
  title: string
  slug: string
  sku: string
  options: { option: string; value: string }[]
  image: string | null
  thumbnail: string | null
}

/**
 * One line on an order. Prices are frozen at checkout; the snapshot is what
 * the customer (and admin) keep seeing after the catalog moves on.
 */
export class OrderItem {
  private constructor(
    readonly id: number,
    readonly variantId: number | null,
    readonly quantity: number,
    readonly unitPrice: Money,
    readonly lineTotal: Money,
    readonly productSnapshot: OrderProductSnapshot
  ) {}

  static create(input: {
    variantId: number
    quantity: number
    unitPrice: Money
    snapshot: OrderProductSnapshot
  }): OrderItem {
    return new OrderItem(
      0,
      input.variantId,
      input.quantity,
      input.unitPrice,
      input.unitPrice.multiply(input.quantity),
      input.snapshot
    )
  }

  static fromPersistence(input: {
    id: number
    variantId: number | null
    quantity: number
    unitPrice: number
    lineTotal: number
    productSnapshot: OrderProductSnapshot
  }): OrderItem {
    return new OrderItem(
      input.id,
      input.variantId,
      input.quantity,
      Money.fromMinor(input.unitPrice),
      Money.fromMinor(input.lineTotal),
      input.productSnapshot
    )
  }
}
