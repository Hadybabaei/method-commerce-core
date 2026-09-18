import { Inject, Injectable } from '@nestjs/common'
import { CLOCK, Clock } from '@shared/application/ports/clock.port'
import { UseCase } from '@shared/application/use-case'
import { PASSWORD_HASHER, PasswordHasher } from '@shared/domain/services/password-hasher'
import { Admin } from '../../domain/entities/admin.aggregate'
import { EmailAlreadyTakenError } from '../../domain/errors/identity.errors'
import { ADMIN_REPOSITORY, AdminRepository } from '../../domain/repositories/admin.repository'
import { EmailAddress } from '../../domain/value-objects/email-address.vo'
import { PlainPassword } from '../../domain/value-objects/plain-password.vo'
import { CreateAdminCommand } from '../dto/commands'
import { AdminView } from '../dto/views'
import { toAdminView } from '../mappers/identity-view.mapper'

@Injectable()
export class CreateAdminUseCase implements UseCase<CreateAdminCommand, AdminView> {
  constructor(
    @Inject(ADMIN_REPOSITORY) private readonly admins: AdminRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(CLOCK) private readonly clock: Clock
  ) {}

  async execute(command: CreateAdminCommand): Promise<AdminView> {
    const email = EmailAddress.create(command.email)

    if (await this.admins.findByEmail(email)) {
      throw new EmailAlreadyTakenError()
    }

    const admin = await Admin.create(
      {
        email,
        password: PlainPassword.create(command.password),
        role: command.role,
        firstName: command.firstName,
        lastName: command.lastName,
        nationalId: command.nationalId,
        address: command.address,
        phoneNumber: command.phoneNumber,
      },
      this.hasher,
      this.clock.now()
    )

    return toAdminView(await this.admins.save(admin))
  }
}
