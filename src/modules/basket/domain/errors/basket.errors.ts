import { BusinessRuleViolationError, ForbiddenError, NotFoundError } from '@shared/domain/errors'

export class BasketNotFoundError extends NotFoundError {
  constructor(userId?: number) {
    super('Basket not found', userId === undefined ? undefined : { user: userId })
  }
}

export class BasketItemNotFoundError extends NotFoundError {
  constructor(variantId?: number) {
    super(
      'That variant is not in the basket',
      variantId === undefined ? undefined : { variant: variantId }
    )
  }
}

export class VariantNotSellableError extends NotFoundError {
  constructor(variantId: number) {
    super('That variant is not available to buy', { variant: variantId })
  }
}

export class InsufficientStockError extends BusinessRuleViolationError {
  constructor(variantId: number, available: number, requested: number) {
    super('Not enough stock for that quantity', {
      variant: variantId,
      available,
      requested,
    })
  }
}

export class BasketNotOwnedError extends ForbiddenError {
  constructor() {
    super('You do not own this basket')
  }
}
