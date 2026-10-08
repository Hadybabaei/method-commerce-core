import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger'
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator'
import { MAX_MONEY_AMOUNT } from '@shared/domain/value-objects/money'

export class CreateShippingMethodRequest {
  @ApiProperty({ example: 'پست پیشتاز' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string

  @ApiProperty({ example: 'post', description: 'Lowercase letters, digits and dashes.' })
  @IsString()
  @Matches(/^[a-z0-9][a-z0-9-]{0,49}$/)
  code: string

  @ApiPropertyOptional({ nullable: true, example: 'ارسال به سراسر کشور' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null

  @ApiProperty({ example: 500_000, description: 'Rial.' })
  @IsInt()
  @Min(0)
  @Max(MAX_MONEY_AMOUNT)
  base_fee: number

  @ApiPropertyOptional({ example: 150_000, description: 'Rial per started kilogram.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_MONEY_AMOUNT)
  per_kg_fee?: number

  @ApiPropertyOptional({
    nullable: true,
    example: 50_000_000,
    description: 'Basket subtotal in Rial at or above which shipping is free. Null = never.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_MONEY_AMOUNT)
  free_above?: number | null

  @ApiPropertyOptional({ nullable: true, example: 2 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  min_days?: number | null

  @ApiPropertyOptional({ nullable: true, example: 5 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  max_days?: number | null

  @ApiPropertyOptional({
    nullable: true,
    type: [Number],
    example: [1, 2],
    description: 'Province ids served. Null = every province.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  @Min(1, { each: true })
  province_ids?: number[] | null

  @ApiPropertyOptional({
    nullable: true,
    example: 'https://tracking.post.ir/?id={code}',
    description: 'Must contain {code}.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  tracking_url_template?: string | null

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean

  @ApiPropertyOptional({ default: 0, description: 'Sort order; lower shows first on ties.' })
  @IsOptional()
  @IsInt()
  position?: number
}

export class UpdateShippingMethodRequest extends PartialType(CreateShippingMethodRequest) {}

export function toShippingMethodInput(body: UpdateShippingMethodRequest) {
  return {
    name: body.name,
    code: body.code,
    description: body.description,
    baseFee: body.base_fee,
    perKgFee: body.per_kg_fee,
    freeAbove: body.free_above,
    minDays: body.min_days,
    maxDays: body.max_days,
    provinceIds: body.province_ids,
    trackingUrlTemplate: body.tracking_url_template,
    isActive: body.is_active,
    position: body.position,
  }
}
