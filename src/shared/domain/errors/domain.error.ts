/**
 * Domain errors are framework-agnostic on purpose: the domain and application
 * layers throw these, and a single presentation-layer filter translates them
 * into HTTP responses.
 */
export abstract class DomainError extends Error {
  abstract readonly code: string

  constructor(
    message: string,
    readonly details?: Record<string, unknown>
  ) {
    super(message)
    this.name = new.target.name
    Error.captureStackTrace?.(this, new.target)
  }
}

/** The requested aggregate does not exist. */
export class NotFoundError extends DomainError {
  readonly code = 'NOT_FOUND'
}

/** The request is understood but breaks a business rule. */
export class BusinessRuleViolationError extends DomainError {
  readonly code = 'BUSINESS_RULE_VIOLATION'
}

/** The input cannot form a valid value object or command. */
export class InvalidInputError extends DomainError {
  readonly code = 'INVALID_INPUT'
}

/** The aggregate would collide with an existing one. */
export class ConflictError extends DomainError {
  readonly code = 'CONFLICT'
}

/** Credentials are missing, wrong, or expired. */
export class UnauthenticatedError extends DomainError {
  readonly code = 'UNAUTHENTICATED'
}

/** The caller is known but not allowed to perform the action. */
export class ForbiddenError extends DomainError {
  readonly code = 'FORBIDDEN'
}

/** Too many attempts in a short window. */
export class TooManyRequestsError extends DomainError {
  readonly code = 'TOO_MANY_REQUESTS'
}
