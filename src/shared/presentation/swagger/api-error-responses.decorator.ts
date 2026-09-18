import { HttpStatus, applyDecorators } from '@nestjs/common'
import { ApiResponse } from '@nestjs/swagger'
import { ErrorResponse } from './error.response'

/**
 * What each status means in this API. Kept here so every endpoint describes a
 * given failure the same way.
 */
const DESCRIPTIONS: Partial<Record<HttpStatus, string>> = {
  [HttpStatus.BAD_REQUEST]: 'The request failed validation, or a value could not be parsed.',
  [HttpStatus.UNAUTHORIZED]:
    'The token is missing, malformed, expired, or meant for another audience.',
  [HttpStatus.FORBIDDEN]: 'Authenticated, but this account may not perform the action.',
  [HttpStatus.NOT_FOUND]: 'No record matches the given identifier.',
  [HttpStatus.CONFLICT]: 'The request collides with an existing record, such as a taken slug.',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'Understood, but it would break a business rule.',
  [HttpStatus.TOO_MANY_REQUESTS]: 'Rate limit exceeded; retry later.',
  [HttpStatus.INTERNAL_SERVER_ERROR]:
    'Unexpected failure. The cause is in the log under the matching requestId, never in the response.',
}

/**
 * Documents the failures an endpoint can return, all sharing `ErrorResponse`.
 *
 * Every status is listed explicitly per endpoint rather than applied globally,
 * so the documentation says what can actually happen instead of listing every
 * status the framework is capable of producing.
 */
export function ApiErrorResponses(...statuses: HttpStatus[]): MethodDecorator & ClassDecorator {
  return applyDecorators(
    ...statuses.map((status) =>
      ApiResponse({
        status,
        type: ErrorResponse,
        description: DESCRIPTIONS[status] ?? 'Request failed.',
      })
    )
  )
}
