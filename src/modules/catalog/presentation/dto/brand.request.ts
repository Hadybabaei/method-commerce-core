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
}

export class UpdateBrandRequest extends PartialType(CreateBrandRequest) {}
