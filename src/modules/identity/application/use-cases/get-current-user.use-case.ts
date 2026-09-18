import { Inject, Injectable } from '@nestjs/common'
import { UseCase } from '@shared/application/use-case'
import { UserNotFoundError } from '../../domain/errors/identity.errors'
import { USER_REPOSITORY, UserRepository } from '../../domain/repositories/user.repository'
import { UserView } from '../dto/views'
import { toUserView } from '../mappers/identity-view.mapper'

@Injectable()
export class GetCurrentUserUseCase implements UseCase<number, UserView> {
  constructor(@Inject(USER_REPOSITORY) private readonly users: UserRepository) {}

  async execute(userId: number): Promise<UserView> {
    const user = await this.users.findById(userId)

    if (!user) {
      throw new UserNotFoundError(userId)
    }

    return toUserView(user)
  }
}
