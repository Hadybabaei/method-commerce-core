import { Basket } from '../entities/basket.aggregate'

export interface BasketRepository {
  findByUserId(userId: number, tx?: unknown): Promise<Basket | null>

  /**
   * Locks the customer's basket (and its lines) inside `tx` so checkout cannot
   * race another POST /orders for the same user.
   */
  lockByUserId(userId: number, tx: unknown): Promise<Basket | null>

  /** Inserts an empty basket or replaces every line to match the aggregate. */
  save(basket: Basket, tx?: unknown): Promise<Basket>
}

export const BASKET_REPOSITORY = Symbol('BasketRepository')
