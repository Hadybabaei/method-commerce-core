import { BaseDomainEvent } from '@shared/domain/domain-event'

export class ProductFavoritedEvent extends BaseDomainEvent<{
  userId: number
  productId: number
}> {
  constructor(userId: number, productId: number) {
    super('favorites.product_favorited', { userId, productId })
  }
}

export class ProductUnfavoritedEvent extends BaseDomainEvent<{
  userId: number
  productId: number
}> {
  constructor(userId: number, productId: number) {
    super('favorites.product_unfavorited', { userId, productId })
  }
}
