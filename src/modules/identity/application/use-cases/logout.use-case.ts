import { Inject, Injectable } from '@nestjs/common'
import { UseCase } from '@shared/application/use-case'
import { UserNotFoundError } from '../../domain/errors/identity.errors'
import { USER_REPOSITORY, UserRepository } from '../../domain/repositories/user.repository'
import { LogoutCommand } from '../dto/commands'

@Injectable()
export class LogoutUseCase implements UseCase<LogoutCommand, void> {
  constructor(@Inject(USER_REPOSITORY) private readonly users: UserRepository) {}

  async execute({ userId }: LogoutCommand): Promise<void> {
    const user = await this.users.findById(userId)

    if (!user) {
      throw new UserNotFoundError(userId)
    }

    user.revokeRefreshToken()
    await this.users.save(user)
  }
}
