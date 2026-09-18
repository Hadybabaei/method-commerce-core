import { UnauthenticatedError } from '@shared/domain/errors'
import { AuthenticatedRequest } from '@shared/presentation/types/authenticated-request'

export function extractBearerToken(request: AuthenticatedRequest): string {
  const header = request.headers.authorization

  if (!header?.startsWith('Bearer ')) {
    throw new UnauthenticatedError('Authorization header with a bearer token is required')
  }

  const token = header.slice('Bearer '.length).trim()

  if (token.length === 0) {
    throw new UnauthenticatedError('Bearer token is empty')
  }

  return token
}
