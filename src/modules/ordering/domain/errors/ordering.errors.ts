import {
  BusinessRuleViolationError,
  ConflictError,
  ForbiddenError,
  InvalidInputError,
  NotFoundError,
} from '@shared/domain/errors'

export class OrderNotFoundError extends NotFoundError {
  constructor(identifier?: number | string) {
    super('Order not found', identifier === undefined ? undefined : { order: identifier })
  }
}

export class OrderNotOwnedError extends ForbiddenError {
  constructor() {
    super('You do not own this order')
  }
}

export class EmptyBasketError extends BusinessRuleViolationError {
  constructor() {
    super('The basket is empty')
  }
}

export class BasketNotReadyError extends BusinessRuleViolationError {
  constructor(details?: Record<string, unknown>) {
    super('The basket has lines that cannot be ordered', details)
  }
}

export class OrderNotCancellableError extends BusinessRuleViolationError {
  constructor(status: string) {
    super('Only a pending order can be cancelled', { status })
  }
}

export class InsufficientStockForOrderError extends BusinessRuleViolationError {
  constructor(variantId: number, available: number, requested: number) {
    super('Not enough stock to place the order', { variant: variantId, available, requested })
  }
}

export class InvalidOrderNoteError extends InvalidInputError {
  constructor() {
    super('Order note is too long')
  }
}

export class OrderNotPayableError extends BusinessRuleViolationError {
  constructor(reason: string, details?: Record<string, unknown>) {
    super(reason, details)
  }
}

export class OrderNotCompletableError extends BusinessRuleViolationError {
  constructor(status: string) {
    super('Only a paid order can be marked completed', { status })
  }
}

export class PaymentNotFoundError extends NotFoundError {
  constructor(identifier?: string | number) {
    super('Payment not found', identifier === undefined ? undefined : { payment: identifier })
  }
}

export class PaymentAlreadyFailedError extends BusinessRuleViolationError {
  constructor() {
    super('This payment attempt has already failed; start a new one with a fresh idempotency key')
  }
}

export class PaymentAlreadyInProgressError extends ConflictError {
  constructor(details?: Record<string, unknown>) {
    super('An online payment is already in progress for this order', details)
  }
}

export class IdempotencyConflictError extends ConflictError {
  constructor() {
    super('Idempotency key was already used with a different payment payload')
  }
}

export class PaymentGatewayError extends BusinessRuleViolationError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, details)
  }
}

export class OrderConflictError extends ConflictError {
  constructor(details?: Record<string, unknown>) {
    super('Order was updated by another request', details)
  }
}

export class InventoryLevelMissingError extends BusinessRuleViolationError {
  constructor(variantId: number, locationId: number) {
    super('Inventory row is missing for a reserved allocation', {
      variant: variantId,
      location: locationId,
    })
  }
}
