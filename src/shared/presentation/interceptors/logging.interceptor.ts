import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  LoggerService,
  NestInterceptor,
} from '@nestjs/common'
import type { Response } from 'express'
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston'
import { Observable, tap } from 'rxjs'
import { AuthenticatedRequest } from '../types/authenticated-request'

/**
 * One log line per completed request. Failures are logged by the exception
 * filter, so this only reports successes.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(@Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly logger: LoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle()
    }

    const http = context.switchToHttp()
    const request = http.getRequest<AuthenticatedRequest>()
    const startedAt = Date.now()

    return next.handle().pipe(
      tap(() => {
        const { statusCode } = http.getResponse<Response>()

        this.logger.log(
          {
            message: `${request.method} ${request.url} ${statusCode} ${Date.now() - startedAt}ms`,
            method: request.method,
            url: request.url,
            statusCode,
            durationMs: Date.now() - startedAt,
            requestId: request.requestId,
            actorId: request.actor?.id,
          },
          'Http'
        )
      })
    )
  }
}
