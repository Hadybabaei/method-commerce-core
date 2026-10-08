import { SEO_DESCRIPTION_MAX, SEO_TITLE_MAX } from '../../domain/value-objects/seo-meta.vo'
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger'
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

export class CreateBrandRequest {
  @ApiProperty({ example: 'بوش' })
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  title: string

  @ApiPropertyOptional({ example: 'bosch', description: 'Derived from the title when omitted.' })
  @IsOptional()
  @IsString()
  @MaxLength(190)
  slug?: string

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  logo?: string | null

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null

  @ApiPropertyOptional({
    nullable: true,
    maxLength: SEO_TITLE_MAX,
    description: 'Search-engine title. Null or empty falls back to the title.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(SEO_TITLE_MAX)
  seo_title?: string | null

  @ApiPropertyOptional({
    nullable: true,
    maxLength: SEO_DESCRIPTION_MAX,
    description: 'Search-engine description. Null or empty falls back to the description.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(SEO_DESCRIPTION_MAX)
  seo_description?: string | null
}

export class UpdateBrandRequest extends PartialType(CreateBrandRequest) {}
