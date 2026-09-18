import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator'
import { MAX_MONEY_AMOUNT } from '@shared/domain/value-objects/money'

export class ProductImageRequest {
  @ApiProperty({ example: 'https://cdn.method-commerce.ir/products/drill-1.jpg' })
  @IsString()
  @MaxLength(1000)
  url: string

  @ApiPropertyOptional({
    example: true,
    description: 'Defaults to the first image when none is marked.',
  })
  @IsOptional()
  @IsBoolean()
  thumbnail?: boolean
}

export class CreateProductRequest {
  @ApiProperty({ example: 'دریل شارژی بوش' })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  title: string

  @ApiPropertyOptional({ description: 'Derived from the title when omitted.' })
  @IsOptional()
  @IsString()
  @MaxLength(190)
  slug?: string

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  sub_title?: string | null

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string | null

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  short_description?: string | null

  @ApiPropertyOptional({
    example: false,
    description: 'Products start as drafts so they can be finished before going live.',
  })
  @IsOptional()
  @IsBoolean()
  published?: boolean

  @ApiPropertyOptional({ example: 1500, description: 'Shipping weight in grams.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  weight_grams?: number

  @ApiPropertyOptional({ example: 4 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  category_id?: number | null

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  brand_id?: number | null

  @ApiPropertyOptional({ type: [ProductImageRequest] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ProductImageRequest)
  images?: ProductImageRequest[]
}

/** Same fields as create, all optional. `images` replaces the whole list. */
export class UpdateProductRequest extends PartialType(CreateProductRequest) {}

export class ProductOptionAxisRequest {
  @ApiProperty({ example: 'رنگ' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name: string

  @ApiProperty({ example: ['قرمز', 'آبی'] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  values: string[]
}

export class ReplaceProductOptionsRequest {
  @ApiProperty({ type: [ProductOptionAxisRequest] })
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => ProductOptionAxisRequest)
  options: ProductOptionAxisRequest[]
}

export class VariantOptionPickRequest {
  @ApiProperty({ example: 'رنگ' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  option: string

  @ApiProperty({ example: 'قرمز' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  value: string
}

export class CreateProductVariantRequest {
  @ApiProperty({ example: 'DRL-RED-L' })
  @IsString()
  @MaxLength(40)
  sku: string

  @ApiProperty({ example: 2_400_000, description: 'Regular price in Rial.' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_MONEY_AMOUNT)
  price: number

  @ApiPropertyOptional({
    example: 2_100_000,
    nullable: true,
    description: 'Must be below price. Omit or null for no sale.',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_MONEY_AMOUNT)
  sale_price?: number | null

  @ApiPropertyOptional({ example: 1500, nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  weight_grams?: number | null

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  image?: string | null

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean

  @ApiPropertyOptional({
    type: [VariantOptionPickRequest],
    description: 'Omit or send [] for a product with no option axes.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => VariantOptionPickRequest)
  options?: VariantOptionPickRequest[]

  @ApiPropertyOptional({
    example: 12,
    description: 'On-hand quantity at the default warehouse. Defaults to 0.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  on_hand?: number
}

export class UpdateProductVariantRequest {
  @ApiPropertyOptional({ example: 'DRL-RED-L' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  sku?: string

  @ApiPropertyOptional({ example: 2_400_000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_MONEY_AMOUNT)
  price?: number

  @ApiPropertyOptional({ example: 2_100_000, nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_MONEY_AMOUNT)
  sale_price?: number | null

  @ApiPropertyOptional({ example: 1500, nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  weight_grams?: number | null

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  image?: string | null

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean

  @ApiPropertyOptional({ example: 12 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  on_hand?: number
}
