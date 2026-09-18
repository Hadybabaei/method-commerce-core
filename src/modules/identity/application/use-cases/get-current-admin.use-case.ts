import { Inject, Injectable } from '@nestjs/common'
import { UseCase } from '@shared/application/use-case'
import { AdminNotFoundError } from '../../domain/errors/identity.errors'
import { ADMIN_REPOSITORY, AdminRepository } from '../../domain/repositories/admin.repository'
import { AdminView } from '../dto/views'
import { toAdminView } from '../mappers/identity-view.mapper'

@Injectable()
export class GetCurrentAdminUseCase implements UseCase<number, AdminView> {
  constructor(@Inject(ADMIN_REPOSITORY) private readonly admins: AdminRepository) {}

  async execute(adminId: number): Promise<AdminView> {
    const admin = await this.admins.findById(adminId)

    if (!admin) {
      throw new AdminNotFoundError(adminId)
    }

    return toAdminView(admin)
  }
}
