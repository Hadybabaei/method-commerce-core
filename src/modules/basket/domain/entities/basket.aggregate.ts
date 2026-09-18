import { AggregateRoot } from '@shared/domain/aggregate-root.base'
import { InvalidInputError } from '@shared/domain/errors'
import { UNSAVED_ID } from '@shared/domain/identifier'
import { BasketItemNotFoundError, BasketNotOwnedError } from '../errors/basket.errors'
import { Quantity } from '../value-objects/quantity.vo'
import { BasketItem } from './basket-item.entity'

/**
 * The customer's open cart. One per account; lines are variants so an order
 * can be cut from this aggregate later without re-picking options.
 */
export class Basket extends AggregateRoot {
  private readonly props: { userId: number }
  private readonly items: BasketItem[]

  private constructor(id: number, userId: number, items: BasketItem[]) {
    super(id)
    this.props = { userId }
    this.items = items
  }

  static create(userId: number): Basket {
    if (!Number.isInteger(userId) || userId <= 0) {
      throw new InvalidInputError('A basket needs a user')
    }

    return new Basket(UNSAVED_ID, userId, [])
  }

  static fromPersistence(id: number, userId: number, items: BasketItem[]): Basket {
    return new Basket(id, userId, items)
  }

  ensureOwnedBy(userId: number): void {
    if (this.props.userId !== userId) {
      throw new BasketNotOwnedError()
    }
  }

  /**
   * Adds a line or merges into an existing one. Callers must already have
   * checked stock for the resulting quantity.
   */
  addItem(variantId: number, quantity: Quantity): void {
    if (quantity.isZero) {
      throw new InvalidInputError('Cannot add a zero quantity')
    }

    const existing = this.items.find((item) => item.variantId === variantId)
    if (existing) {
      existing.increase(quantity)
      return
    }

    this.items.push(BasketItem.create(variantId, quantity))
  }

  setQuantity(variantId: number, quantity: Quantity): void {
    if (quantity.isZero) {
      this.removeItem(variantId)
      return
    }

    this.findItem(variantId).setQuantity(quantity)
  }

  increase(variantId: number, by: Quantity): void {
    if (by.isZero) {
      return
    }

    this.findItem(variantId).increase(by)
  }

  /**
   * Lowers the line; removing it when the result would be zero.
   */
  decrease(variantId: number, by: Quantity): void {
    if (by.isZero) {
      return
    }

    const item = this.findItem(variantId)
    const next = item.quantityVo.subtract(by)
    if (next.isZero) {
      this.removeItem(variantId)
      return
    }

    item.setQuantity(next)
  }

  removeItem(variantId: number): void {
    const index = this.items.findIndex((item) => item.variantId === variantId)
    if (index < 0) {
      throw new BasketItemNotFoundError(variantId)
    }

    this.items.splice(index, 1)
  }

  clear(): void {
    this.items.length = 0
  }

  findItem(variantId: number): BasketItem {
    const item = this.items.find((candidate) => candidate.variantId === variantId)
    if (!item) {
      throw new BasketItemNotFoundError(variantId)
    }

    return item
  }

  tryFindItem(variantId: number): BasketItem | null {
    return this.items.find((item) => item.variantId === variantId) ?? null
  }

  get userId(): number {
    return this.props.userId
  }

  getItems(): readonly BasketItem[] {
    return [...this.items]
  }

  get isEmpty(): boolean {
    return this.items.length === 0
  }

  get itemCount(): number {
    return this.items.length
  }

  get totalQuantity(): number {
    return this.items.reduce((sum, item) => sum + item.quantityValue, 0)
  }
}
