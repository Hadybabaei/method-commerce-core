import { AggregateRoot } from '@shared/domain/aggregate-root.base'
import { UNSAVED_ID } from '@shared/domain/identifier'
import { PasswordHasher } from '@shared/domain/services/password-hasher'
import { AdminRole } from '../enums/roles.enum'
import {
  AccountDisabledError,
  CannotDeletePrimaryAdminError,
  InvalidCredentialsError,
  InvalidPasswordResetTokenError,
  PasswordResetNotRequestedError,
  PasswordResetTokenExpiredError,
  SamePasswordError,
} from '../errors/identity.errors'
import {
  AdminPasswordChangedEvent,
  AdminPasswordResetRequestedEvent,
} from '../events/identity.events'
import { EmailAddress } from '../value-objects/email-address.vo'
import { PasswordResetToken } from '../value-objects/password-reset-token.vo'
import { PlainPassword } from '../value-objects/plain-password.vo'

export interface AdminProps {
  email: EmailAddress
  passwordHash: string
  role: AdminRole
  active: boolean
  firstName: string | null
  lastName: string | null
  nationalId: string | null
  address: string | null
  avatarUrl: string | null
  phoneNumber: string | null
  passwordReset: PasswordResetToken | null
  createdAt: Date
}

export interface AdminDetailsChanges {
  firstName?: string | null
  lastName?: string | null
  nationalId?: string | null
  address?: string | null
  avatarUrl?: string | null
  phoneNumber?: string | null
  role?: AdminRole
  active?: boolean
}

/**
 * A back-office account. Unlike customers, admins authenticate with an email
 * and password, which is why the password lifecycle (login, reset, change)
 * lives entirely on this aggregate.
 */
export class Admin extends AggregateRoot {
  private props: AdminProps

  private constructor(id: number, props: AdminProps) {
    super(id)
    this.props = props
  }

  static async create(
    input: {
      email: EmailAddress
      password: PlainPassword
      role: AdminRole
      firstName?: string | null
      lastName?: string | null
      nationalId?: string | null
      address?: string | null
      avatarUrl?: string | null
      phoneNumber?: string | null
    },
    hasher: PasswordHasher,
    now: Date
  ): Promise<Admin> {
    return new Admin(UNSAVED_ID, {
      email: input.email,
      passwordHash: await hasher.hash(input.password.value),
      role: input.role,
      active: true,
      firstName: input.firstName ?? null,
      lastName: input.lastName ?? null,
      nationalId: input.nationalId ?? null,
      address: input.address ?? null,
      avatarUrl: input.avatarUrl ?? null,
      phoneNumber: input.phoneNumber ?? null,
      passwordReset: null,
      createdAt: now,
    })
  }

  static fromPersistence(id: number, props: AdminProps): Admin {
    return new Admin(id, props)
  }

  // ---- authentication ----

  /**
   * Verifies a login attempt. Wrong password and disabled account are reported
   * separately only after the password checks out, so the endpoint cannot be
   * used to probe which emails exist.
   *
   * Records no domain event: a successful login changes nothing here, so the
   * use case is what announces it.
   */
  async authenticate(candidatePassword: string, hasher: PasswordHasher): Promise<void> {
    const matches = await hasher.compare(candidatePassword ?? '', this.props.passwordHash)

    if (!matches) {
      throw new InvalidCredentialsError()
    }

    this.ensureActive()
  }

  ensureActive(): void {
    if (!this.props.active) {
      throw new AccountDisabledError()
    }
  }

  // ---- password lifecycle ----

  requestPasswordReset(resetToken: PasswordResetToken): void {
    this.props = { ...this.props, passwordReset: resetToken }
    this.addDomainEvent(new AdminPasswordResetRequestedEvent(this.id, this.props.email.value))
  }

  /** Consumes a reset token issued by `requestPasswordReset`. */
  async resetPassword(
    candidateToken: string,
    newPassword: PlainPassword,
    hasher: PasswordHasher,
    now: Date
  ): Promise<void> {
    const { passwordReset } = this.props

    if (!passwordReset) {
      throw new PasswordResetNotRequestedError()
    }

    if (!passwordReset.matches(candidateToken)) {
      throw new InvalidPasswordResetTokenError()
    }

    if (passwordReset.isExpired(now)) {
      throw new PasswordResetTokenExpiredError()
    }

    this.props = {
      ...this.props,
      passwordHash: await hasher.hash(newPassword.value),
      passwordReset: null,
    }
    this.addDomainEvent(new AdminPasswordChangedEvent(this.id))
  }

  /** Changes the password of a signed-in admin who knows the current one. */
  async changePassword(
    currentPassword: string,
    newPassword: PlainPassword,
    hasher: PasswordHasher
  ): Promise<void> {
    const matches = await hasher.compare(currentPassword ?? '', this.props.passwordHash)

    if (!matches) {
      throw new InvalidCredentialsError()
    }

    if (await hasher.compare(newPassword.value, this.props.passwordHash)) {
      throw new SamePasswordError()
    }

    this.props = {
      ...this.props,
      passwordHash: await hasher.hash(newPassword.value),
      passwordReset: null,
    }
    this.addDomainEvent(new AdminPasswordChangedEvent(this.id))
  }

  // ---- profile ----

  updateDetails(changes: AdminDetailsChanges): void {
    const next: AdminProps = { ...this.props }

    for (const [key, value] of Object.entries(changes)) {
      if (value !== undefined) {
        Object.assign(next, { [key]: value })
      }
    }

    this.props = next
  }

  changeEmail(email: EmailAddress): void {
    this.props = { ...this.props, email }
  }

  /** The bootstrap super admin must always remain available. */
  ensureDeletable(): void {
    if (this.props.role === AdminRole.SuperAdmin) {
      throw new CannotDeletePrimaryAdminError()
    }
  }

  // ---- accessors ----

  get email(): EmailAddress {
    return this.props.email
  }

  get passwordHash(): string {
    return this.props.passwordHash
  }

  get role(): AdminRole {
    return this.props.role
  }

  get isActive(): boolean {
    return this.props.active
  }

  get firstName(): string | null {
    return this.props.firstName
  }

  get lastName(): string | null {
    return this.props.lastName
  }

  get fullName(): string | null {
    const parts = [this.props.firstName, this.props.lastName].filter(Boolean)
    return parts.length > 0 ? parts.join(' ') : null
  }

  get nationalId(): string | null {
    return this.props.nationalId
  }

  get address(): string | null {
    return this.props.address
  }

  get avatarUrl(): string | null {
    return this.props.avatarUrl
  }

  get phoneNumber(): string | null {
    return this.props.phoneNumber
  }

  get passwordReset(): PasswordResetToken | null {
    return this.props.passwordReset
  }

  get createdAt(): Date {
    return this.props.createdAt
  }
}
