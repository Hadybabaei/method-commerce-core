import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator'

export class CreateCategoryRequest {
  @ApiProperty({ example: 'ابزار برقی' })
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  title: string

  @ApiPropertyOptional({
    example: 'power-tools',
    description: 'Derived from the title when omitted.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(190)
  slug?: string

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  icon?: string | null

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null

  @ApiPropertyOptional({ example: 3, description: 'Omit or send null for a root category.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  parent_id?: number | null

  @ApiPropertyOptional({ example: 0, description: 'Sort order among siblings.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  position?: number
}

/**
 * Same fields as create, all optional. Sending `parent_id` moves the category
 * and its whole subtree.
 */
export class UpdateCategoryRequest extends PartialType(CreateCategoryRequest) {}
