import type { Request } from 'express'
import { TokenAudience } from '@shared/application/ports/token-service.port'

/** Whoever is behind the current request, resolved from the bearer token. */
export interface AuthenticatedActor {
  id: number
  role: string
  audience: TokenAudience
  phoneNumber?: string
  email?: string
  authLevel?: number
  /** Back-office permissions; set for admins only. */
  permissions?: string[]
}

export interface AuthenticatedRequest extends Request {
  actor?: AuthenticatedActor
  requestId?: string
}
