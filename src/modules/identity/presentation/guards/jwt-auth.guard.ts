import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common'
import { TOKEN_SERVICE, TokenService } from '@shared/application/ports/token-service.port'
import { UnauthenticatedError } from '@shared/domain/errors'
import { AuthenticatedRequest } from '@shared/presentation/types/authenticated-request'
import { USER_REPOSITORY, UserRepository } from '../../domain/repositories/user.repository'
import { extractBearerToken } from './bearer-token'

/**
 * Authenticates a customer. The account is re-read on every request so a
 * deactivated user loses access without waiting for the token to expire.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    @Inject(TOKEN_SERVICE) private readonly tokenService: TokenService,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    const claims = await this.tokenService.verify(extractBearerToken(request))

    if (claims.type !== 'access' || claims.audience !== 'user') {
      throw new UnauthenticatedError('A user access token is required')
    }

    const user = await this.users.findById(claims.sub)

    if (!user) {
      throw new UnauthenticatedError('Account no longer exists')
    }

    user.ensureActive()

    request.actor = {
      id: user.id,
      role: user.role,
      audience: 'user',
      phoneNumber: user.phoneNumber.value,
      email: user.email?.value,
      authLevel: user.authLevel,
    }

    return true
  }
}
