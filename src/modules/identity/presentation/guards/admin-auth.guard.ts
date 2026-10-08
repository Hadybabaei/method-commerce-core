import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { ForbiddenError, UnauthenticatedError } from '@shared/domain/errors'
import { PERMISSION_KEY } from '@shared/presentation/decorators/require-permission.decorator'
import { AdminPermission } from '../../domain/permissions'
import { TOKEN_SERVICE, TokenService } from '@shared/application/ports/token-service.port'
import { AuthenticatedRequest } from '@shared/presentation/types/authenticated-request'
import { ADMIN_REPOSITORY, AdminRepository } from '../../domain/repositories/admin.repository'
import { extractBearerToken } from './bearer-token'

/** Authenticates a back-office account and checks the route's @RequirePermission, if any. */
@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(
    @Inject(TOKEN_SERVICE) private readonly tokenService: TokenService,
    @Inject(ADMIN_REPOSITORY) private readonly admins: AdminRepository,
    private readonly reflector: Reflector
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

    const needed = this.reflector.getAllAndOverride<AdminPermission | undefined>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (needed && !admin.hasPermission(needed)) {
      throw new ForbiddenError('Your account does not have permission for this', {
        permission: needed,
      })
    }

    request.actor = {
      id: admin.id,
      role: admin.role,
      audience: 'admin',
      email: admin.email.value,
      phoneNumber: admin.phoneNumber ?? undefined,
      permissions: admin.effectivePermissions,
    }

    return true
  }
}
