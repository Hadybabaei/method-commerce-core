import { AggregateRoot } from '@shared/domain/aggregate-root.base'
import { UNSAVED_ID } from '@shared/domain/identifier'
import { CUSTOMER_ROLE_TO_USER_TYPE, CustomerRole, UserType } from '../enums/roles.enum'
import {
  AccountDisabledError,
  InvalidOtpError,
  OtpExpiredError,
  OtpNotRequestedError,
  ProfileAlreadyExistsError,
  RefreshTokenMismatchError,
} from '../errors/identity.errors'
import {
  OtpIssuedEvent,
  UserAuthenticatedEvent,
  UserProfileCompletedEvent,
  UserRegisteredEvent,
} from '../events/identity.events'
import { EmailAddress } from '../value-objects/email-address.vo'
import { Otp } from '../value-objects/otp.vo'
import { PhoneNumber } from '../value-objects/phone-number.vo'
import { UserProfile, UserProfileChanges } from './user-profile.entity'

/** Identity verification tiers, kept compatible with the legacy `auth_level`. */
export const AuthLevel = {
  Unverified: 0,
  IdentityVerified: 1,
  FullyVerified: 2,
} as const

export interface UserProps {
  phoneNumber: PhoneNumber
  email: EmailAddress | null
  role: CustomerRole
  type: UserType
  authLevel: number
  /** Becomes true the first time the phone number is proven via OTP. */
  activated: boolean
  avatar: string | null
  otp: Otp | null
  refreshToken: string | null
  profile: UserProfile | null
  createdAt: Date
  updatedAt: Date | null
}

/**
 * A customer account. Authentication is passwordless: the account proves
 * ownership of a phone number with a one-time code, and all the rules about
 * when a code is valid live here rather than in a service.
 */
export class User extends AggregateRoot {
  private props: UserProps

  private constructor(id: number, props: UserProps) {
    super(id)
    this.props = props
  }

  static register(phoneNumber: PhoneNumber, now: Date): User {
    const user = new User(UNSAVED_ID, {
      phoneNumber,
      email: null,
      role: CustomerRole.User,
      type: UserType.Normal,
      authLevel: AuthLevel.Unverified,
      activated: false,
      avatar: null,
      otp: null,
      refreshToken: null,
      profile: null,
      createdAt: now,
      updatedAt: null,
    })

    user.addDomainEvent(new UserRegisteredEvent(phoneNumber.value))

    return user
  }

  static fromPersistence(id: number, props: UserProps): User {
    return new User(id, props)
  }

  // ---- authentication ----

  /** Replaces any pending code; requesting a new code invalidates the old one. */
  issueOtp(otp: Otp): void {
    this.props = { ...this.props, otp }
    this.addDomainEvent(new OtpIssuedEvent(this.props.phoneNumber.value, otp.expiresAt))
  }

  /**
   * Consumes the pending code. Succeeding activates the account, because
   * passing the OTP is exactly what proves the phone number belongs to them.
   */
  verifyOtp(candidate: string, now: Date): void {
    const { otp } = this.props

    if (!otp) {
      throw new OtpNotRequestedError()
    }

    if (!otp.matches(candidate)) {
      throw new InvalidOtpError()
    }

    if (otp.isExpired(now)) {
      throw new OtpExpiredError()
    }

    this.props = { ...this.props, otp: null, activated: true, updatedAt: now }
    this.addDomainEvent(new UserAuthenticatedEvent(this.id, this.props.phoneNumber.value))
  }

  /**
   * Activates the account after an external OTP store has already validated
   * the code (Redis TTL challenge). Clears any legacy DB-held OTP.
   */
  confirmPhoneVerified(now: Date): void {
    this.props = { ...this.props, otp: null, activated: true, updatedAt: now }
    this.addDomainEvent(new UserAuthenticatedEvent(this.id, this.props.phoneNumber.value))
  }

  attachRefreshToken(refreshToken: string): void {
    this.props = { ...this.props, refreshToken }
  }

  revokeRefreshToken(): void {
    this.props = { ...this.props, refreshToken: null }
  }

  ensureRefreshTokenMatches(candidate: string): void {
    if (!this.props.refreshToken || this.props.refreshToken !== candidate) {
      throw new RefreshTokenMismatchError()
    }
  }

  /**
   * A deactivated account can hold valid tokens, so every authenticated entry
   * point has to re-check this.
   */
  ensureActive(): void {
    if (!this.props.activated) {
      throw new AccountDisabledError()
    }
  }

  deactivate(): void {
    this.props = { ...this.props, activated: false, refreshToken: null }
  }

  // ---- profile and contact details ----

  changeEmail(email: EmailAddress | null): void {
    this.props = { ...this.props, email }
  }

  changeAvatar(avatar: string | null): void {
    this.props = { ...this.props, avatar }
  }

  /** Creating the profile is what promotes the account to identity-verified. */
  attachProfile(profile: UserProfile): void {
    if (this.props.profile) {
      throw new ProfileAlreadyExistsError()
    }

    this.props = {
      ...this.props,
      profile,
      authLevel: Math.max(this.props.authLevel, AuthLevel.IdentityVerified),
    }
    this.addDomainEvent(new UserProfileCompletedEvent(this.id))
  }

  /** Applies profile changes, creating the profile if the user has none yet. */
  updateProfile(changes: UserProfileChanges): void {
    if (!this.props.profile) {
      this.attachProfile(UserProfile.create(changes))
      return
    }

    this.props.profile.apply(changes)
  }

  assignRole(role: CustomerRole): void {
    this.props = { ...this.props, role, type: CUSTOMER_ROLE_TO_USER_TYPE[role] }
  }

  touch(now: Date): void {
    this.props = { ...this.props, updatedAt: now }
  }

  // ---- accessors ----

  get phoneNumber(): PhoneNumber {
    return this.props.phoneNumber
  }

  get email(): EmailAddress | null {
    return this.props.email
  }

  get role(): CustomerRole {
    return this.props.role
  }

  get type(): UserType {
    return this.props.type
  }

  get authLevel(): number {
    return this.props.authLevel
  }

  get isActivated(): boolean {
    return this.props.activated
  }

  get avatar(): string | null {
    return this.props.avatar
  }

  get otp(): Otp | null {
    return this.props.otp
  }

  get refreshToken(): string | null {
    return this.props.refreshToken
  }

  get profile(): UserProfile | null {
    return this.props.profile
  }

  get createdAt(): Date {
    return this.props.createdAt
  }

  get updatedAt(): Date | null {
    return this.props.updatedAt
  }
}
