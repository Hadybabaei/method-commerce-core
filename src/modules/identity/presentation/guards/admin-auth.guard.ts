import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common'
import { TOKEN_SERVICE, TokenService } from '@shared/application/ports/token-service.port'
import { UnauthenticatedError } from '@shared/domain/errors'
import { AuthenticatedRequest } from '@shared/presentation/types/authenticated-request'
import { ADMIN_REPOSITORY, AdminRepository } from '../../domain/repositories/admin.repository'
import { extractBearerToken } from './bearer-token'

/** Authenticates a back-office account. */
@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(
    @Inject(TOKEN_SERVICE) private readonly tokenService: TokenService,
    @Inject(ADMIN_REPOSITORY) private readonly admins: AdminRepository
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    const claims = await this.tokenService.verify(extractBearerToken(request))

    if (claims.type !== 'access' || claims.audience !== 'admin') {
      throw new UnauthenticatedError('An admin access token is required')
    }

    const admin = await this.admins.findById(claims.sub)

    if (!admin) {
      throw new UnauthenticatedError('Admin account no longer exists')
    }

    admin.ensureActive()

    request.actor = {
      id: admin.id,
      role: admin.role,
      audience: 'admin',
      email: admin.email.value,
      phoneNumber: admin.phoneNumber ?? undefined,
    }

    return true
  }
}
