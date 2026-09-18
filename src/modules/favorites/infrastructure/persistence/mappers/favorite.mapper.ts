import { Favorite } from '../../../domain/entities/favorite.aggregate'
import { user_favorite } from '@prisma/client'

export type FavoriteRecord = user_favorite

export function toDomainFavorite(record: FavoriteRecord): Favorite {
  return Favorite.fromPersistence(record.id, {
    userId: record.userId,
    productId: record.productId,
    favoritedAt: record.created_at,
  })
}
