import { ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator'
import { ProductSort } from '../../application/dto/commands'
import { MAX_MONEY_AMOUNT } from '@shared/domain/value-objects/money'

const SORTS: ProductSort[] = ['newest', 'oldest', 'title', 'price_asc', 'price_desc']

export class ListProductsRequest {
  @ApiPropertyOptional({ example: 1, description: 'Exact product id.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  product_id?: number

  @ApiPropertyOptional({ example: 4, description: 'Includes every sub-category.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  category_id?: number

  @ApiPropertyOptional({ example: 'power-tools', description: 'Includes every sub-category.' })
  @IsOptional()
  @IsString()
  @MaxLength(190)
  category_slug?: string

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  brand_id?: number

  @ApiPropertyOptional({ example: 'bosch' })
  @IsOptional()
  @IsString()
  @MaxLength(190)
  brand_slug?: string

  @ApiPropertyOptional({
    example: 'دریل',
    description: 'Matches the product title only.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  title?: string

  @ApiPropertyOptional({
    example: 'شارژی',
    description: 'Matches the title and sub-title.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  search?: string

  @ApiPropertyOptional({
    example: 1_000_000,
    description: "Minimum for the product's cheapest active variant price, in Rial.",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_MONEY_AMOUNT)
  price_min?: number

  @ApiPropertyOptional({
    example: 5_000_000,
    description: "Maximum for the product's cheapest active variant price, in Rial.",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_MONEY_AMOUNT)
  price_max?: number

  @ApiPropertyOptional({
    example: 1,
    description:
      'Minimum available units across active variants (on_hand − reserved). Use 1 for in-stock only.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  quantity_min?: number

  @ApiPropertyOptional({
    enum: SORTS,
    default: 'newest',
    description:
      'price_asc / price_desc use the cheapest active variant; products without an active variant are omitted for those sorts.',
  })
  @IsOptional()
  @IsIn(SORTS)
  sort?: ProductSort

  @ApiPropertyOptional({ example: 20, minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number

  @ApiPropertyOptional({ example: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number
}
