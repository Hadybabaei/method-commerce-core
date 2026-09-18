import { Inject, Injectable } from '@nestjs/common'
import { TOKEN_SERVICE, TokenService } from '@shared/application/ports/token-service.port'
import { UseCase } from '@shared/application/use-case'
import { UnauthenticatedError } from '@shared/domain/errors'
import { UserNotFoundError } from '../../domain/errors/identity.errors'
import { USER_REPOSITORY, UserRepository } from '../../domain/repositories/user.repository'
import { RefreshAccessTokenCommand } from '../dto/commands'
import { AccessTokenView } from '../dto/views'

/**
 * Trades a refresh token for a new access token. The token must both verify
 * cryptographically and still be the one stored on the account, so a logout
 * invalidates it immediately.
 */
@Injectable()
export class RefreshAccessTokenUseCase implements UseCase<
  RefreshAccessTokenCommand,
  AccessTokenView
> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(TOKEN_SERVICE) private readonly tokenService: TokenService
  ) {}

  async execute({ refreshToken }: RefreshAccessTokenCommand): Promise<AccessTokenView> {
    const claims = await this.tokenService.verify(refreshToken)

    if (claims.type !== 'refresh' || claims.audience !== 'user') {
      throw new UnauthenticatedError('A user refresh token is required')
    }

    const user = await this.users.findById(claims.sub)

    if (!user) {
      throw new UserNotFoundError(claims.sub)
    }

    user.ensureActive()
    user.ensureRefreshTokenMatches(refreshToken)

    const accessToken = await this.tokenService.signAccessToken({
      sub: user.id,
      role: user.role as string,
      audience: 'user',
      phoneNumber: user.phoneNumber.value,
      email: user.email?.value,
    })

    return { accessToken }
  }
}
