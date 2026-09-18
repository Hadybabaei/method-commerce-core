import { Admin } from '../../domain/entities/admin.aggregate'
import { User } from '../../domain/entities/user.aggregate'
import { AdminView, UserView } from '../dto/views'

/**
 * Turns aggregates into the read shapes the API exposes. Kept in the
 * application layer so the domain never has to know what a client wants.
 */
export function toUserView(user: User): UserView {
  const profile = user.profile

  return {
    id: user.id,
    phoneNumber: user.phoneNumber.value,
    email: user.email?.value ?? null,
    role: user.role,
    type: user.type,
    authLevel: user.authLevel,
    activated: user.isActivated,
    avatar: user.avatar,
    firstName: profile?.firstName ?? null,
    lastName: profile?.lastName ?? null,
    fatherName: profile?.fatherName ?? null,
    nationalId: profile?.nationalId?.value ?? null,
    birthDate: profile?.birthDate ?? null,
    phone: profile?.phone ?? null,
    companyName: profile?.companyName ?? null,
    createdAt: user.createdAt,
  }
}

export function toAdminView(admin: Admin): AdminView {
  return {
    id: admin.id,
    email: admin.email.value,
    role: admin.role,
    active: admin.isActive,
    firstName: admin.firstName,
    lastName: admin.lastName,
    nationalId: admin.nationalId,
    address: admin.address,
    avatarUrl: admin.avatarUrl,
    phoneNumber: admin.phoneNumber,
    createdAt: admin.createdAt,
  }
}
