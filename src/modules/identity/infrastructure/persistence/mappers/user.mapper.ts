import { Prisma } from '@prisma/client'
import { UserProfile } from '../../../domain/entities/user-profile.entity'
import { User } from '../../../domain/entities/user.aggregate'
import { CustomerRole, UserType } from '../../../domain/enums/roles.enum'
import { EmailAddress } from '../../../domain/value-objects/email-address.vo'
import { NationalId } from '../../../domain/value-objects/national-id.vo'
import { Otp } from '../../../domain/value-objects/otp.vo'
import { PhoneNumber } from '../../../domain/value-objects/phone-number.vo'

export type UserRecord = Prisma.userGetPayload<{ include: { profile: true } }>
type UserProfileRecord = NonNullable<UserRecord['profile']>

/**
 * Translates between the `user` table and the `User` aggregate. Column names
 * stay snake_case for legacy compatibility; the domain never sees them.
 */
export function toDomainUser(record: UserRecord): User {
  return User.fromPersistence(record.id, {
    phoneNumber: PhoneNumber.fromPersistence(record.phone_number),
    email: record.email ? EmailAddress.fromPersistence(record.email) : null,
    role: toCustomerRole(record.role),
    type: record.type as UserType,
    authLevel: record.auth_level,
    activated: record.account_status ?? false,
    avatar: record.avatar,
    otp:
      record.otp_code && record.otp_expiry
        ? Otp.fromPersistence(record.otp_code, record.otp_expiry)
        : null,
    refreshToken: record.refresh_token,
    profile: record.profile ? toDomainUserProfile(record.profile) : null,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  })
}

export function toDomainUserProfile(record: UserProfileRecord): UserProfile {
  return UserProfile.fromPersistence(record.id, {
    firstName: record.first_name,
    lastName: record.last_name,
    fatherName: record.father_name,
    nationalId: record.national_id ? NationalId.fromPersistence(record.national_id) : null,
    birthDate: record.birth_date,
    phone: record.phone,
    companyName: record.company_name,
    registerCode: record.register_code,
    taxId: record.tax_id,
    businessRoleId: record.business_role_id,
  })
}

/** Columns owned by the aggregate root. `created_at`/`updated_at` are left to the database. */
export function toUserWriteData(user: User) {
  return {
    phone_number: user.phoneNumber.value,
    email: user.email?.value ?? null,
    role: user.role,
    type: user.type as UserType,
    auth_level: user.authLevel,
    account_status: user.isActivated,
    avatar: user.avatar,
    otp_code: user.otp?.code ?? null,
    otp_expiry: user.otp?.expiresAt ?? null,
    refresh_token: user.refreshToken,
  }
}

export function toUserProfileWriteData(profile: UserProfile) {
  const props = profile.snapshot()

  return {
    first_name: props.firstName,
    last_name: props.lastName,
    father_name: props.fatherName,
    national_id: props.nationalId?.value ?? null,
    birth_date: props.birthDate,
    phone: props.phone,
    company_name: props.companyName,
    register_code: props.registerCode,
    tax_id: props.taxId,
    business_role_id: props.businessRoleId,
  }
}

function toCustomerRole(role: string): CustomerRole {
  return Object.values(CustomerRole).includes(role as CustomerRole)
    ? (role as CustomerRole)
    : CustomerRole.User
}
