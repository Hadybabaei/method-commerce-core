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
  constructor(status: string, details: Record<string, unknown> = {}) {
    super(
      details.reason === 'payment_captured'
        ? 'A captured payment cannot be cancelled'
        : 'Only a pending order can be cancelled',
      { status, ...details }
    )
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
    super('Only a paid, processing or shipped order can be marked completed', { status })
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

export class OrderNotProcessableError extends BusinessRuleViolationError {
  constructor(status: string) {
    super('Only a paid order can start processing', { status })
  }
}

export class OrderNotShippableError extends BusinessRuleViolationError {
  constructor(status: string) {
    super('Only a paid or processing order can be shipped', { status })
  }
}

export class InvalidTrackingCodeError extends InvalidInputError {
  constructor() {
    super('Tracking code must be 1 to 100 characters')
  }
}

export class InvalidShippingMethodError extends InvalidInputError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, details)
  }
}

export class ShippingMethodNotFoundError extends NotFoundError {
  constructor(identifier?: number) {
    super(
      'Shipping method not found',
      identifier === undefined ? undefined : { shippingMethod: identifier }
    )
  }
}

export class ShippingMethodCodeTakenError extends ConflictError {
  constructor(code: string) {
    super('Another shipping method already uses this code', { code })
  }
}

/** The store ships, but not to this address's province. */
export class ShippingUnavailableError extends BusinessRuleViolationError {
  constructor(provinceId: number) {
    super('No shipping method delivers to this province', { province: provinceId })
  }
}

/** The customer picked a method that is inactive or does not serve the address. */
export class ShippingMethodNotOfferedError extends BusinessRuleViolationError {
  constructor(shippingMethodId: number, provinceId: number) {
    super('This shipping method is not available for the delivery address', {
      shippingMethod: shippingMethodId,
      province: provinceId,
    })
  }
}

export class ReturnRequestNotFoundError extends NotFoundError {
  constructor(identifier?: number) {
    super(
      'Return request not found',
      identifier === undefined ? undefined : { returnRequest: identifier }
    )
  }
}

/** The order cannot be returned (not delivered, or the window has closed). */
export class ReturnNotAllowedError extends BusinessRuleViolationError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, details)
  }
}

export class InvalidReturnRequestError extends InvalidInputError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, details)
  }
}

export class ReturnAlreadyDecidedError extends BusinessRuleViolationError {
  constructor(status: string) {
    super('This return request was already decided', { status })
  }
}

export class RefundNotAllowedError extends BusinessRuleViolationError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, details)
  }
}

export class InvalidRefundError extends InvalidInputError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, details)
  }
}
