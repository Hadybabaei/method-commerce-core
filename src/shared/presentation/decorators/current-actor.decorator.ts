import {
  createParamDecorator,
  ExecutionContext,
  InternalServerErrorException,
} from '@nestjs/common'
import { AuthenticatedActor, AuthenticatedRequest } from '../types/authenticated-request'

/**
 * Injects the authenticated actor. Only valid on routes behind an auth guard.
 */
export const CurrentActor = createParamDecorator(
  (property: keyof AuthenticatedActor | undefined, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()

    if (!request.actor) {
      throw new InternalServerErrorException('Route is missing an authentication guard')
    }

    return property ? request.actor[property] : request.actor
  }
)
