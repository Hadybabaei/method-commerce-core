import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { ForbiddenError } from '@shared/domain/errors'
import { ROLES_KEY } from '@shared/presentation/decorators/roles.decorator'
import { AuthenticatedRequest } from '@shared/presentation/types/authenticated-request'

/** Runs after an auth guard and narrows access to the roles on `@Roles()`. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    if (!required || required.length === 0) {
      return true
    }

    const { actor } = context.switchToHttp().getRequest<AuthenticatedRequest>()

    if (!actor || !required.includes(actor.role)) {
      throw new ForbiddenError('You do not have permission to perform this action')
    }

    return true
  }
}
