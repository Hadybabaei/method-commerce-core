import { admin as AdminRecord } from '@prisma/client'
import { Admin } from '../../../domain/entities/admin.aggregate'
import { AdminRole } from '../../../domain/enums/roles.enum'
import { EmailAddress } from '../../../domain/value-objects/email-address.vo'
import { PasswordResetToken } from '../../../domain/value-objects/password-reset-token.vo'

export type { AdminRecord }

export function toDomainAdmin(record: AdminRecord): Admin {
  return Admin.fromPersistence(record.id, {
    email: EmailAddress.fromPersistence(record.email),
    passwordHash: record.password,
    role: toAdminRole(record.role),
    active: record.status,
    firstName: record.first_name,
    lastName: record.last_name,
    nationalId: record.nationalId,
    address: record.address,
    avatarUrl: record.avatarUrl,
    phoneNumber: record.phone_number,
    passwordReset:
      record.reset_password_token && record.reset_token_expire
        ? PasswordResetToken.create(record.reset_password_token, record.reset_token_expire)
        : null,
    createdAt: record.created_at,
  })
}

export function toAdminWriteData(admin: Admin) {
  return {
    email: admin.email.value,
    password: admin.passwordHash,
    role: admin.role,
    status: admin.isActive,
    first_name: admin.firstName,
    last_name: admin.lastName,
    nationalId: admin.nationalId,
    address: admin.address,
    avatarUrl: admin.avatarUrl,
    phone_number: admin.phoneNumber,
    reset_password_token: admin.passwordReset?.token ?? null,
    reset_token_expire: admin.passwordReset?.expiresAt ?? null,
  }
}

function toAdminRole(role: string): AdminRole {
  return Object.values(AdminRole).includes(role as AdminRole)
    ? (role as AdminRole)
    : AdminRole.Operator
}
