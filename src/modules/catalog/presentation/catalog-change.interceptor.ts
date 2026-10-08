import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { Observable, tap } from 'rxjs'
import { CATALOG_CHANGED, CatalogChange } from '../domain/events/catalog-changed'

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

const toId = (value: unknown) => {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

/**
 * What a successful admin write changed, from its route; null when it did not
 * touch the catalog. Categories and brands are copied into every product they
 * hold, so changing one counts as changing everything.
 */
export function catalogChangeFor(
  method: string,
  routePath: string,
  params: Record<string, unknown>,
  responseBody: unknown
): CatalogChange | null {
  if (!MUTATING.has(method)) return null
  const route = routePath.replace(/^.*?\/admin\//, 'admin/')
  if (route.startsWith('admin/categories') || route.startsWith('admin/brands')) {
    return { productIds: [], variantIds: [], everything: true }
  }
  if (route.startsWith('admin/products')) {
    const fromParams = toId(params.id)
    const created =
      responseBody && typeof responseBody === 'object'
        ? toId((responseBody as { id?: unknown }).id)
        : null
    const id = fromParams ?? created
    return id ? { productIds: [id], variantIds: [], everything: false } : null
  }
  if (route.startsWith('admin/stock')) {
    const variantId = toId(params.variantId)
    return variantId ? { productIds: [], variantIds: [variantId], everything: false } : null
  }
  return null
}

/**
 * Announces catalog writes made through admin routes as one `catalog.changed`
 * event, so search, caches and the storefront refresh without every use case
 * having to remember them.
 */
@Injectable()
export class CatalogChangeInterceptor implements NestInterceptor {
  constructor(private readonly emitter: EventEmitter2) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle()
    const request = context.switchToHttp().getRequest<{
      method: string
      url: string
      route?: { path?: string }
      params?: Record<string, unknown>
    }>()

    return next.handle().pipe(
      tap((body) => {
        const change = catalogChangeFor(
          request.method,
          request.route?.path ?? request.url,
          request.params ?? {},
          body
        )
        if (change) void this.emitter.emitAsync(CATALOG_CHANGED, change).catch(() => undefined)
      })
    )
  }
}
