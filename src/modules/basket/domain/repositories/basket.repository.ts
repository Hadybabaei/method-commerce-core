import { Basket } from '../entities/basket.aggregate'

export interface BasketRepository {
  findByUserId(userId: number): Promise<Basket | null>

  /** Inserts an empty basket or replaces every line to match the aggregate. */
  save(basket: Basket, tx?: unknown): Promise<Basket>
}

export const BASKET_REPOSITORY = Symbol('BasketRepository')
