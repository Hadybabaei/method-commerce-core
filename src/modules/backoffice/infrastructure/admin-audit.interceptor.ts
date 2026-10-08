import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common'
import { Observable, tap } from 'rxjs'
import { AuthenticatedRequest } from '@shared/presentation/types/authenticated-request'
import { AUDIT_LOG, AuditLog } from '../application/backoffice.ports'

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
const SECRET_KEY = /password|token|secret|otp/i
const MAX_PAYLOAD_CHARS = 10_000

/** Copies a request body without anything that looks like a secret. */
export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact)
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, inner]) => [
        key,
        SECRET_KEY.test(key) ? '[redacted]' : redact(inner),
      ])
    )
  }
  return value
}

/** "/api/admin/orders/:id/refunds" → entity "orders". */
export function auditTarget(routePath: string, params: Record<string, string | string[]>) {
  const afterAdmin = routePath.split('/admin/')[1] ?? ''
  const entity = afterAdmin.split('/')[0] || 'admin'
  const raw = params.id ?? params.variantId ?? params.productId ?? params.adminId
  const entityId = raw === undefined ? null : Array.isArray(raw) ? raw.join(',') : raw
  return { entity, entityId }
}

/**
 * Records every successful change made through an admin route: who, which
 * route, the target id and the request body (secrets removed). Writing the
 * log never fails or slows the request.
 */
@Injectable()
export class AdminAuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AdminAuditInterceptor.name)

  constructor(@Inject(AUDIT_LOG) private readonly audit: AuditLog) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle()
    const http = context.switchToHttp()
    const request = http.getRequest<AuthenticatedRequest & { route?: { path?: string } }>()

    return next.handle().pipe(
      tap(() => {
        if (!MUTATING.has(request.method) || request.actor?.audience !== 'admin') return

        const routePath = request.route?.path ?? request.url
        const { entity, entityId } = auditTarget(routePath, request.params ?? {})
        const body = redact(request.body)
        const serialized = JSON.stringify(body ?? null)
        const payload =
          serialized.length > MAX_PAYLOAD_CHARS
            ? { truncated: true, chars: serialized.length }
            : body
        const status = http.getResponse<{ statusCode: number }>().statusCode

        void this.audit
          .record({
            adminId: request.actor.id,
            action: `${request.method} ${routePath.replace(/^\/[^/]+(?=\/admin\/)/, '')}`,
            entity,
            entityId,
            payload,
            status,
          })
          .catch((error: unknown) =>
            this.logger.error(
              `Audit log write failed for ${request.method} ${routePath}`,
              error instanceof Error ? error.stack : undefined
            )
          )
      })
    )
  }
}
