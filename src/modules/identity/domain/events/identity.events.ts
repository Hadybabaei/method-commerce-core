import { BaseDomainEvent } from '@shared/domain/domain-event'

export class UserRegisteredEvent extends BaseDomainEvent<{ phoneNumber: string }> {
  constructor(phoneNumber: string) {
    super('identity.user.registered', { phoneNumber })
  }
}

export class OtpIssuedEvent extends BaseDomainEvent<{ phoneNumber: string; expiresAt: Date }> {
  constructor(phoneNumber: string, expiresAt: Date) {
    super('identity.otp.issued', { phoneNumber, expiresAt })
  }
}

export class UserAuthenticatedEvent extends BaseDomainEvent<{
  userId: number
  phoneNumber: string
}> {
  constructor(userId: number, phoneNumber: string) {
    super('identity.user.authenticated', { userId, phoneNumber })
  }
}

export class UserProfileCompletedEvent extends BaseDomainEvent<{ userId: number }> {
  constructor(userId: number) {
    super('identity.user.profile_completed', { userId })
  }
}

export class AdminAuthenticatedEvent extends BaseDomainEvent<{ adminId: number; email: string }> {
  constructor(adminId: number, email: string) {
    super('identity.admin.authenticated', { adminId, email })
  }
}

export class AdminPasswordChangedEvent extends BaseDomainEvent<{ adminId: number }> {
  constructor(adminId: number) {
    super('identity.admin.password_changed', { adminId })
  }
}

export class AdminPasswordResetRequestedEvent extends BaseDomainEvent<{
  adminId: number
  email: string
}> {
  constructor(adminId: number, email: string) {
    super('identity.admin.password_reset_requested', { adminId, email })
  }
}
