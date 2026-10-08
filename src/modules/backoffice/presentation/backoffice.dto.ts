import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Transform, Type } from 'class-transformer'
import {
  IsBoolean,
  IsDate,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator'

export class DateRangeQuery {
  @ApiPropertyOptional({ description: 'Start (inclusive). Defaults to 30 days ago.' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date

  @ApiPropertyOptional({ description: 'End (exclusive). Defaults to now.' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date
}

export class TopProductsQuery extends DateRangeQuery {
  @ApiPropertyOptional({ example: 10, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number
}

export class PageQuery {
  @ApiPropertyOptional({ example: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number
}

export class CustomersQuery extends PageQuery {
  @ApiPropertyOptional({ description: 'Phone number or name.' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  search?: string
}

export class StockQuery extends PageQuery {
  @ApiPropertyOptional({ description: 'SKU or product title.' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string

  @ApiPropertyOptional({ description: 'Only variants at or below their low-stock threshold.' })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  low_only?: boolean
}

export class AdjustStockRequest {
  @ApiProperty({ example: -2, description: 'Units to add (positive) or remove (negative).' })
  @IsInt()
  delta: number

  @ApiProperty({ example: 'شمارش انبار', minLength: 3 })
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  reason: string

  @ApiPropertyOptional({ description: 'Warehouse; defaults to the first active one.' })
  @IsOptional()
  @IsInt()
  @Min(1)
  location_id?: number
}

export class StockThresholdRequest {
  @ApiProperty({ nullable: true, example: 5, description: 'Null turns the alert off.' })
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(0)
  low_stock_threshold: number | null
}

export class AuditQuery extends PageQuery {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  admin_id?: number

  @ApiPropertyOptional({ example: 'orders' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  entity?: string

  @ApiPropertyOptional({ example: '42' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  entity_id?: string
}
