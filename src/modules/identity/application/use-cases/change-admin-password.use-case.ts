import { Inject, Injectable } from '@nestjs/common'
import { UseCase } from '@shared/application/use-case'
import { PASSWORD_HASHER, PasswordHasher } from '@shared/domain/services/password-hasher'
import { AdminNotFoundError } from '../../domain/errors/identity.errors'
import { ADMIN_REPOSITORY, AdminRepository } from '../../domain/repositories/admin.repository'
import { PlainPassword } from '../../domain/value-objects/plain-password.vo'
import { ChangeAdminPasswordCommand } from '../dto/commands'

@Injectable()
export class ChangeAdminPasswordUseCase implements UseCase<ChangeAdminPasswordCommand, void> {
  constructor(
    @Inject(ADMIN_REPOSITORY) private readonly admins: AdminRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher
  ) {}

  async execute({
    adminId,
    currentPassword,
    newPassword,
  }: ChangeAdminPasswordCommand): Promise<void> {
    const admin = await this.admins.findById(adminId)

    if (!admin) {
      throw new AdminNotFoundError(adminId)
    }

    await admin.changePassword(currentPassword, PlainPassword.create(newPassword), this.hasher)

    await this.admins.save(admin)
  }
}
