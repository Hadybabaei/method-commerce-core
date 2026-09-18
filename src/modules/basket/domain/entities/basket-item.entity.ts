import { Quantity } from '../value-objects/quantity.vo'

/**
 * One line in a basket. Identity is the variant — adding the same variant
 * again merges into this row.
 */
export class BasketItem {
  private constructor(
    readonly variantId: number,
    private quantity: Quantity
  ) {}

  static create(variantId: number, quantity: Quantity): BasketItem {
    return new BasketItem(variantId, quantity)
  }

  static fromPersistence(variantId: number, quantity: number): BasketItem {
    return new BasketItem(variantId, Quantity.of(quantity))
  }

  increase(by: Quantity): void {
    this.quantity = this.quantity.add(by)
  }

  decrease(by: Quantity): void {
    this.quantity = this.quantity.subtract(by)
  }

  setQuantity(quantity: Quantity): void {
    this.quantity = quantity
  }

  get quantityValue(): number {
    return this.quantity.value
  }

  get quantityVo(): Quantity {
    return this.quantity
  }
}
