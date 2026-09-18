import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

/**
 * The response body every failure produces. Mirrors what
 * `AllExceptionsFilter` writes, so the documented shape and the real one
 * cannot drift apart without the filter changing too.
 */
export class ErrorResponse {
  @ApiProperty({ example: false })
  success: false

  @ApiProperty({ example: 404 })
  statusCode: number

  @ApiProperty({
    example: 'NOT_FOUND',
    description:
      'Stable machine-readable code: NOT_FOUND, INVALID_INPUT, BUSINESS_RULE_VIOLATION, CONFLICT, UNAUTHENTICATED, FORBIDDEN, TOO_MANY_REQUESTS or INTERNAL_ERROR.',
  })
  code: string

  @ApiProperty({
    example: 'Product not found',
    description: 'One message, or a list of them when several validation rules failed.',
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
  })
  message: string | string[]

  @ApiPropertyOptional({
    description: 'Context for the failure, such as the field or id that caused it.',
    example: { product: 'cordless-drill' },
    additionalProperties: true,
  })
  details?: Record<string, unknown>

  @ApiProperty({ example: '/api/products/cordless-drill' })
  path: string

  @ApiPropertyOptional({
    description: 'Echo of the x-request-id header, for matching a response to a log line.',
    example: '0f1c3b6a-2d4e-4f80-9c2b-7a1e5d3f9b11',
  })
  requestId?: string

  @ApiProperty({ example: '2026-09-11T17:12:16.090Z' })
  timestamp: string
}
