import { SetMetadata } from '@nestjs/common'

export const ROLES_KEY = 'method-commerce:roles'

/** Restricts a route to the listed roles; enforced by `RolesGuard`. */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles)
