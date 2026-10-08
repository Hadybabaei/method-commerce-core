import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsInt, IsOptional, Min, ValidateIf } from 'class-validator'

export class AddFavoriteRequest {
  @ApiProperty({ example: 1, description: 'Id of the product to save.' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  product_id: number

  @ApiPropertyOptional({
    example: 12,
    nullable: true,
    description: 'The chosen variant of that product.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  variant_id?: number | null
}

export class ChooseFavoriteVariantRequest {
  @ApiProperty({ example: 12, nullable: true, description: 'Null = the product in general.' })
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(1)
  variant_id: number | null
}
