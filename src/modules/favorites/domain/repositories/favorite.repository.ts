import { Favorite } from '../entities/favorite.aggregate'

export interface FavoriteRepository {
  findByUserAndProduct(userId: number, productId: number): Promise<Favorite | null>

  /** Inserts when the aggregate is new. Favorites are never updated. */
  save(favorite: Favorite): Promise<Favorite>

  /** Deletes the row and publishes any events the aggregate recorded. */
  delete(favorite: Favorite): Promise<void>
}

export const FAVORITE_REPOSITORY = Symbol('FavoriteRepository')
