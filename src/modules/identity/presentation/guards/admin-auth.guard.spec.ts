import { ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { TokenService } from '@shared/application/ports/token-service.port'
import { ForbiddenError } from '@shared/domain/errors'
import { Admin } from '../../domain/entities/admin.aggregate'
import { AdminRole } from '../../domain/enums/roles.enum'
import { AdminPermission } from '../../domain/permissions'
import { AdminRepository } from '../../domain/repositories/admin.repository'
import { EmailAddress } from '../../domain/value-objects/email-address.vo'
import { AdminAuthGuard } from './admin-auth.guard'

function admin(role: AdminRole, permissions: AdminPermission[]): Admin {
  return Admin.fromPersistence(5, {
    email: EmailAddress.create('op@method.ir'),
    passwordHash: 'x',
    role,
    permissions,
    active: true,
    firstName: null,
    lastName: null,
    nationalId: null,
    address: null,
    avatarUrl: null,
    phoneNumber: null,
    passwordReset: null,
    createdAt: new Date(),
  })
}

function check(account: Admin, needed: AdminPermission | undefined) {
  const request: Record<string, unknown> = { headers: { authorization: 'Bearer t' } }
  const tokens = {
    verify: jest.fn().mockResolvedValue({ type: 'access', audience: 'admin', sub: 5 }),
  } as unknown as TokenService
  const admins = { findById: jest.fn().mockResolvedValue(account) } as unknown as AdminRepository
  const reflector = { getAllAndOverride: () => needed } as unknown as Reflector
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext
  return { request, result: new AdminAuthGuard(tokens, admins, reflector).canActivate(context) }
}

describe('AdminAuthGuard permissions', () => {
  it('lets an admin through when the route needs a permission they hold', async () => {
    const { request, result } = check(admin(AdminRole.Operator, ['orders']), 'orders')
    await expect(result).resolves.toBe(true)
    expect(request.actor).toMatchObject({ id: 5, permissions: ['orders'] })
  })

  it('refuses a missing permission with 403', async () => {
    await expect(
      check(admin(AdminRole.Operator, ['orders']), 'refunds').result
    ).rejects.toBeInstanceOf(ForbiddenError)
  })

  it('gives the super admin every permission', async () => {
    const { request, result } = check(admin(AdminRole.SuperAdmin, []), 'settings')
    await expect(result).resolves.toBe(true)
    expect((request.actor as { permissions: string[] }).permissions).toContain('admins')
  })

  it('only needs a valid admin when the route names no permission', async () => {
    await expect(check(admin(AdminRole.Operator, []), undefined).result).resolves.toBe(true)
  })
})
