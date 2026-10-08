import {
  applyDecorators,
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor,
  SetMetadata,
  UseInterceptors,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { from, Observable, of, switchMap, tap } from 'rxjs'
import { RESPONSE_CACHE, ResponseCache } from '@shared/application/ports/response-cache.port'

const CACHED_READ = 'cachedRead'

interface CachedReadOptions {
  namespace: string
  ttlSeconds: number
}

/**
 * Serves an anonymous GET from the response cache. Requests carrying a token
 * always go to the handler, so nothing personal is ever shared.
 */
@Injectable()
export class CachedReadInterceptor implements NestInterceptor {
  constructor(
    @Inject(RESPONSE_CACHE) private readonly cache: ResponseCache,
    private readonly reflector: Reflector
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const options = this.reflector.get<CachedReadOptions | undefined>(
      CACHED_READ,
      context.getHandler()
    )
    const http = context.switchToHttp()
    const request = http.getRequest<{
      method: string
      originalUrl?: string
      url: string
      headers: Record<string, unknown>
    }>()
    const response = http.getResponse<{ setHeader(name: string, value: string): void }>()
    if (!options || request.method !== 'GET' || request.headers.authorization) return next.handle()

    return from(this.cache.version(options.namespace)).pipe(
      switchMap((version) => {
        const key = `${options.namespace}:${version}:${request.originalUrl ?? request.url}`
        return from(this.cache.get(key)).pipe(
          switchMap((hit) => {
            if (hit !== null) {
              response.setHeader('X-Cache', 'HIT')
              return of(JSON.parse(hit) as unknown)
            }
            response.setHeader('X-Cache', 'MISS')
            return next.handle().pipe(
              tap((body) => {
                if (body !== undefined)
                  void this.cache.set(key, JSON.stringify(body), options.ttlSeconds)
              })
            )
          })
        )
      })
    )
  }
}

/** Caches this public read for `ttlSeconds`, until the namespace is bumped. */
export function CachedRead(namespace: string, ttlSeconds: number) {
  return applyDecorators(
    SetMetadata(CACHED_READ, { namespace, ttlSeconds } satisfies CachedReadOptions),
    UseInterceptors(CachedReadInterceptor)
  )
}
