import { Inject, Injectable } from '@nestjs/common'
import { CLOCK, Clock } from '@shared/application/ports/clock.port'
import { UseCase } from '@shared/application/use-case'
import { UserProfileChanges } from '../../domain/entities/user-profile.entity'
import { UserNotFoundError } from '../../domain/errors/identity.errors'
import { USER_REPOSITORY, UserRepository } from '../../domain/repositories/user.repository'
import { EmailAddress } from '../../domain/value-objects/email-address.vo'
import { NationalId } from '../../domain/value-objects/national-id.vo'
import { UpdateUserInfoCommand } from '../dto/commands'
import { UserView } from '../dto/views'
import { toUserView } from '../mappers/identity-view.mapper'

/**
 * Partial update of the signed-in customer's own account and profile. Absent
 * keys are left untouched; an explicit `null` clears the field.
 */
@Injectable()
export class UpdateUserInfoUseCase implements UseCase<UpdateUserInfoCommand, UserView> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(CLOCK) private readonly clock: Clock
  ) {}

  async execute(command: UpdateUserInfoCommand): Promise<UserView> {
    const user = await this.users.findById(command.userId)

    if (!user) {
      throw new UserNotFoundError(command.userId)
    }

    if (command.email !== undefined) {
      user.changeEmail(command.email ? EmailAddress.create(command.email) : null)
    }

    if (command.avatar !== undefined) {
      user.changeAvatar(command.avatar)
    }

    const profileChanges = this.toProfileChanges(command)

    if (Object.keys(profileChanges).length > 0) {
      user.updateProfile(profileChanges)
    }

    user.touch(this.clock.now())

    return toUserView(await this.users.save(user))
  }

  private toProfileChanges(command: UpdateUserInfoCommand): UserProfileChanges {
    const changes: UserProfileChanges = {}

    if (command.firstName !== undefined) changes.firstName = command.firstName
    if (command.lastName !== undefined) changes.lastName = command.lastName
    if (command.fatherName !== undefined) changes.fatherName = command.fatherName
    if (command.birthDate !== undefined) changes.birthDate = command.birthDate
    if (command.phone !== undefined) changes.phone = command.phone
    if (command.companyName !== undefined) changes.companyName = command.companyName
    if (command.nationalId !== undefined) {
      changes.nationalId = command.nationalId ? NationalId.create(command.nationalId) : null
    }

    return changes
  }
}
