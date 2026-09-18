import { ConflictError, ForbiddenError, NotFoundError } from '@shared/domain/errors'

export class FavoriteNotFoundError extends NotFoundError {
  constructor(productId?: number) {
    super(
      'That product is not in your favorites',
      productId === undefined ? undefined : { product: productId }
    )
  }
}

export class FavoriteAlreadyExistsError extends ConflictError {
  constructor(productId: number) {
    super('That product is already in your favorites', { product: productId })
  }
}

export class FavoriteNotOwnedError extends ForbiddenError {
  constructor() {
    super('You do not own this favorite')
  }
}
