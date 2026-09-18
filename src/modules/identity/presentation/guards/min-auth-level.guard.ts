import { CanActivate, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { ForbiddenError } from '@shared/domain/errors'
import { AuthenticatedRequest } from '@shared/presentation/types/authenticated-request'

export const MIN_AUTH_LEVEL_KEY = 'method-commerce:min-auth-level'

/** Requires the customer to have reached a given identity verification tier. */
export const MinAuthLevel = (level: number) => SetMetadata(MIN_AUTH_LEVEL_KEY, level)

@Injectable()
export class MinAuthLevelGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<number | undefined>(MIN_AUTH_LEVEL_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    if (required === undefined) {
      return true
    }

    const { actor } = context.switchToHttp().getRequest<AuthenticatedRequest>()

    if ((actor?.authLevel ?? 0) < required) {
      throw new ForbiddenError('Please complete your identity verification first')
    }

    return true
  }
}
