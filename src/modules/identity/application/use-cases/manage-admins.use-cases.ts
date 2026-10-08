import { Inject, Injectable } from '@nestjs/common'
import { UseCase } from '@shared/application/use-case'
import { BusinessRuleViolationError, NotFoundError } from '@shared/domain/errors'
import { AdminRole } from '../../domain/enums/roles.enum'
import { normalizePermissions } from '../../domain/permissions'
import { ADMIN_REPOSITORY, AdminRepository } from '../../domain/repositories/admin.repository'
import { AdminView } from '../dto/views'
import { toAdminView } from '../mappers/identity-view.mapper'

@Injectable()
export class ListAdminsUseCase implements UseCase<void, AdminView[]> {
  constructor(@Inject(ADMIN_REPOSITORY) private readonly admins: AdminRepository) {}

  async execute(): Promise<AdminView[]> {
    return (await this.admins.findAll()).map(toAdminView)
  }
}

@Injectable()
export class UpdateAdminPermissionsUseCase implements UseCase<
  { adminId: number; permissions: string[] },
  AdminView
> {
  constructor(@Inject(ADMIN_REPOSITORY) private readonly admins: AdminRepository) {}

  async execute(command: { adminId: number; permissions: string[] }): Promise<AdminView> {
    const admin = await this.admins.findById(command.adminId)
    if (!admin) {
      throw new NotFoundError('Admin not found', { admin: command.adminId })
    }
    if (admin.role === AdminRole.SuperAdmin) {
      throw new BusinessRuleViolationError('The super admin always holds every permission')
    }
    admin.setPermissions(normalizePermissions(command.permissions))
    return toAdminView(await this.admins.save(admin))
  }
}
