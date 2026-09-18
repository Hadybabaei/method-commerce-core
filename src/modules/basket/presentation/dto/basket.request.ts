import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsInt, IsOptional, Max, Min } from 'class-validator'
import { MAX_BASKET_LINE_QUANTITY } from '../../domain/value-objects/quantity.vo'

export class AddBasketItemRequest {
  @ApiProperty({ example: 11, description: 'Id of the product variant to add.' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  variant_id: number

  @ApiProperty({ example: 1, minimum: 1, maximum: MAX_BASKET_LINE_QUANTITY })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_BASKET_LINE_QUANTITY)
  quantity: number
}

export class SetBasketItemQuantityRequest {
  @ApiProperty({
    example: 2,
    minimum: 0,
    maximum: MAX_BASKET_LINE_QUANTITY,
    description: 'Set to 0 to remove the line.',
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_BASKET_LINE_QUANTITY)
  quantity: number
}

export class AdjustBasketItemRequest {
  @ApiPropertyOptional({
    example: 1,
    minimum: 1,
    maximum: MAX_BASKET_LINE_QUANTITY,
    description: 'Defaults to 1.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_BASKET_LINE_QUANTITY)
  by?: number
}
