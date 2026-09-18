import { Inject, Injectable } from '@nestjs/common'
import { CLOCK, Clock } from '@shared/application/ports/clock.port'
import { UseCase } from '@shared/application/use-case'
import { PASSWORD_HASHER, PasswordHasher } from '@shared/domain/services/password-hasher'
import { AdminNotFoundError } from '../../domain/errors/identity.errors'
import { ADMIN_REPOSITORY, AdminRepository } from '../../domain/repositories/admin.repository'
import { EmailAddress } from '../../domain/value-objects/email-address.vo'
import { PlainPassword } from '../../domain/value-objects/plain-password.vo'
import { ResetAdminPasswordCommand } from '../dto/commands'

/**
 * Completes the forgotten-password flow. Resetting also clears any stored
 * reset token so the same code cannot be replayed.
 */
@Injectable()
export class ResetAdminPasswordUseCase implements UseCase<ResetAdminPasswordCommand, void> {
  constructor(
    @Inject(ADMIN_REPOSITORY) private readonly admins: AdminRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(CLOCK) private readonly clock: Clock
  ) {}

  async execute({ email, token, newPassword }: ResetAdminPasswordCommand): Promise<void> {
    const admin = await this.admins.findByEmail(EmailAddress.create(email))

    if (!admin) {
      throw new AdminNotFoundError(email)
    }

    admin.ensureActive()

    await admin.resetPassword(
      token,
      PlainPassword.create(newPassword),
      this.hasher,
      this.clock.now()
    )

    await this.admins.save(admin)
  }
}
