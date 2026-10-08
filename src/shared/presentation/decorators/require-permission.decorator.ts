import { SetMetadata } from '@nestjs/common'

export const PERMISSION_KEY = 'method-commerce:permission'

/**
 * The admin permission a route needs (e.g. 'orders'). Checked by
 * AdminAuthGuard; a method-level value overrides the controller's.
 */
export const RequirePermission = (permission: string) => SetMetadata(PERMISSION_KEY, permission)
