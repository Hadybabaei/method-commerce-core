import { BasketView } from '../dto/views'

export interface BasketReadModel {
  getByUserId(userId: number): Promise<BasketView | null>
}

export const BASKET_READ_MODEL = Symbol('BasketReadModel')
