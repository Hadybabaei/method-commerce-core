import { InvalidInputError } from '@shared/domain/errors'

/**
 * What a back-office account may do. The super admin role holds every
 * permission implicitly; other admins hold the ones ticked on their account.
 */
export const ADMIN_PERMISSIONS = [
  'catalog',
  'stock',
  'orders',
  'refunds',
  'customers',
  'promotions',
  'comments',
  'reports',
  'settings',
  'admins',
] as const

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number]

export function normalizePermissions(raw: readonly string[]): AdminPermission[] {
  const unknown = raw.filter((value) => !ADMIN_PERMISSIONS.includes(value as AdminPermission))
  if (unknown.length > 0) {
    throw new InvalidInputError('Unknown permissions', { unknown, allowed: ADMIN_PERMISSIONS })
  }
  return ADMIN_PERMISSIONS.filter((permission) => raw.includes(permission))
}

/** Reads the stored JSON column; anything unexpected becomes no permission. */
export function permissionsFromJson(value: unknown): AdminPermission[] {
  return Array.isArray(value)
    ? ADMIN_PERMISSIONS.filter((permission) => value.includes(permission))
    : []
}
