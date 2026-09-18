import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Inject,
  LoggerService,
} from '@nestjs/common'
import type { Response } from 'express'
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston'
import {
  BusinessRuleViolationError,
  ConflictError,
  DomainError,
  ForbiddenError,
  InvalidInputError,
  NotFoundError,
  TooManyRequestsError,
  UnauthenticatedError,
} from '@shared/domain/errors'
import { AuthenticatedRequest } from '../types/authenticated-request'

type DomainErrorType = abstract new (...args: never[]) => DomainError

const DOMAIN_ERROR_STATUS = new Map<DomainErrorType, HttpStatus>([
  [NotFoundError, HttpStatus.NOT_FOUND],
  [InvalidInputError, HttpStatus.BAD_REQUEST],
  [BusinessRuleViolationError, HttpStatus.UNPROCESSABLE_ENTITY],
  [ConflictError, HttpStatus.CONFLICT],
  [UnauthenticatedError, HttpStatus.UNAUTHORIZED],
  [ForbiddenError, HttpStatus.FORBIDDEN],
  [TooManyRequestsError, HttpStatus.TOO_MANY_REQUESTS],
])

interface ErrorBody {
  success: false
  statusCode: number
  code: string
  message: string | string[]
  details?: Record<string, unknown>
  path: string
  requestId?: string
  timestamp: string
}

/**
 * The one place where errors become HTTP responses. Domain errors keep the
 * domain layer free of framework types; everything else degrades to a 500 with
 * the stack recorded in the log rather than the response body.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(@Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly logger: LoggerService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp()
    const request = http.getRequest<AuthenticatedRequest>()
    const response = http.getResponse<Response>()

    const body = this.toErrorBody(exception, request)

    if (body.statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} -> ${body.statusCode} ${JSON.stringify(body.message)}`,
        exception instanceof Error ? exception.stack : undefined,
        'ExceptionFilter'
      )
    } else {
      this.logger.warn(
        `${request.method} ${request.url} -> ${body.statusCode} ${JSON.stringify(body.message)}`,
        'ExceptionFilter'
      )
    }

    response.status(body.statusCode).json(body)
  }

  private toErrorBody(exception: unknown, request: AuthenticatedRequest): ErrorBody {
    const base = {
      success: false as const,
      path: request.url,
      requestId: request.requestId,
      timestamp: new Date().toISOString(),
    }

    if (exception instanceof DomainError) {
      return {
        ...base,
        statusCode: this.statusForDomainError(exception),
        code: exception.code,
        message: exception.message,
        details: exception.details,
      }
    }

    if (exception instanceof HttpException) {
      const payload = exception.getResponse()
      const message =
        typeof payload === 'string'
          ? payload
          : ((payload as { message?: string | string[] }).message ?? exception.message)

      return {
        ...base,
        statusCode: exception.getStatus(),
        code: this.codeFromStatus(exception.getStatus()),
        message,
      }
    }

    return {
      ...base,
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error',
    }
  }

  private statusForDomainError(error: DomainError): HttpStatus {
    for (const [type, status] of DOMAIN_ERROR_STATUS) {
      if (error instanceof type) return status
    }
    return HttpStatus.BAD_REQUEST
  }

  private codeFromStatus(status: number): string {
    return HttpStatus[status] ?? 'HTTP_ERROR'
  }
}
