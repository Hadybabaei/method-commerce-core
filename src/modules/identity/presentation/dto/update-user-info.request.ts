import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsEmail, IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator'

/**
 * Every field is optional: omitting a key leaves it unchanged, sending `null`
 * clears it.
 */
export class UpdateUserInfoRequest {
  @ApiPropertyOptional({ example: 'user@example.com', nullable: true })
  @IsOptional()
  @IsEmail()
  email?: string | null

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  avatar?: string | null

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  first_name?: string | null

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  last_name?: string | null

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  father_name?: string | null

  @ApiPropertyOptional({ example: '0012345678', nullable: true })
  @IsOptional()
  @IsString()
  national_id?: string | null

  @ApiPropertyOptional({ example: '1990-05-21', description: 'ISO date', nullable: true })
  @IsOptional()
  @IsISO8601()
  birth_date?: string | null

  @ApiPropertyOptional({ description: 'Landline or secondary phone', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string | null

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  company_name?: string | null
}
