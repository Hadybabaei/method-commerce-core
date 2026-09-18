import { randomUUID } from 'node:crypto'
import { Injectable, NestMiddleware } from '@nestjs/common'
import type { NextFunction, Response } from 'express'
import { AuthenticatedRequest } from '../types/authenticated-request'

export const REQUEST_ID_HEADER = 'x-request-id'

/**
 * Correlates every log line of a request. Honours an upstream id when the
 * gateway already set one.
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(request: AuthenticatedRequest, response: Response, next: NextFunction): void {
    const incoming = request.header(REQUEST_ID_HEADER)
    const requestId = incoming && incoming.length <= 128 ? incoming : randomUUID()

    request.requestId = requestId
    response.setHeader(REQUEST_ID_HEADER, requestId)
    next()
  }
}
