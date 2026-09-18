import {
  BusinessRuleViolationError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthenticatedError,
} from '@shared/domain/errors'

export class UserNotFoundError extends NotFoundError {
  constructor(identifier?: string | number) {
    super('User not found', identifier === undefined ? undefined : { identifier })
  }
}

export class AdminNotFoundError extends NotFoundError {
  constructor(identifier?: string | number) {
    super('Admin not found', identifier === undefined ? undefined : { identifier })
  }
}

export class PhoneNumberAlreadyTakenError extends ConflictError {
  constructor() {
    super('This phone number is already registered')
  }
}

export class EmailAlreadyTakenError extends ConflictError {
  constructor() {
    super('This email address is already registered')
  }
}

/** No OTP was ever requested for this account. */
export class OtpNotRequestedError extends BusinessRuleViolationError {
  constructor() {
    super('No verification code has been requested for this phone number')
  }
}

export class InvalidOtpError extends UnauthenticatedError {
  constructor() {
    super('The verification code is incorrect')
  }
}

export class OtpExpiredError extends UnauthenticatedError {
  constructor() {
    super('The verification code has expired')
  }
}

export class InvalidCredentialsError extends UnauthenticatedError {
  constructor() {
    super('Invalid email or password')
  }
}

export class AccountDisabledError extends ForbiddenError {
  constructor() {
    super('This account is disabled')
  }
}

export class RefreshTokenMismatchError extends UnauthenticatedError {
  constructor() {
    super('Refresh token is no longer valid')
  }
}

export class PasswordResetNotRequestedError extends BusinessRuleViolationError {
  constructor() {
    super('No password reset has been requested for this account')
  }
}

export class InvalidPasswordResetTokenError extends UnauthenticatedError {
  constructor() {
    super('The password reset token is incorrect')
  }
}

export class PasswordResetTokenExpiredError extends UnauthenticatedError {
  constructor() {
    super('The password reset token has expired')
  }
}

export class SamePasswordError extends BusinessRuleViolationError {
  constructor() {
    super('The new password must differ from the current one')
  }
}

export class ProfileAlreadyExistsError extends ConflictError {
  constructor() {
    super('This user already has a profile')
  }
}

export class CannotDeletePrimaryAdminError extends BusinessRuleViolationError {
  constructor() {
    super('The primary admin account cannot be deleted')
  }
}
