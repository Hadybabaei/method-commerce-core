import { Type, applyDecorators } from '@nestjs/common'
import { ApiExtraModels, ApiOkResponse, ApiProperty, getSchemaPath } from '@nestjs/swagger'

/** Envelope shared by every offset-paginated list. */
export class PaginationMeta {
  @ApiProperty({ example: 42, description: 'Rows matching the filter, ignoring the page.' })
  total: number

  @ApiProperty({ example: 20 })
  limit: number

  @ApiProperty({ example: 0 })
  offset: number
}

/**
 * Documents a paginated list of `item`.
 *
 * Generics disappear at runtime, so the item schema has to be referenced by
 * hand; this keeps that detail in one place instead of in every controller.
 */
export function ApiPaginatedResponse<TItem extends Type<unknown>>(
  item: TItem,
  description?: string
): MethodDecorator {
  return applyDecorators(
    ApiExtraModels(PaginationMeta, item),
    ApiOkResponse({
      description,
      schema: {
        allOf: [
          { $ref: getSchemaPath(PaginationMeta) },
          {
            type: 'object',
            required: ['items'],
            properties: {
              items: { type: 'array', items: { $ref: getSchemaPath(item) } },
            },
          },
        ],
      },
    })
  )
}
