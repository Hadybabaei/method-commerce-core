import { FavoriteView } from '../dto/views'

export interface FavoriteReadModel {
  /** Newest first. Unpublished products are omitted as if they were gone. */
  listByUserId(userId: number): Promise<FavoriteView[]>

  findByUserAndProduct(userId: number, productId: number): Promise<FavoriteView | null>
}

export const FAVORITE_READ_MODEL = Symbol('FavoriteReadModel')
