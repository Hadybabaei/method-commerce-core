import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Transform, Type } from 'class-transformer'
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator'

function emptyToUndefined({ value }: { value: unknown }): unknown {
  if (value === '' || value === null || value === undefined) {
    return undefined
  }
  return value
}

function toOptionalInt({ value }: { value: unknown }): unknown {
  if (value === '' || value === null || value === undefined) {
    return undefined
  }
  return typeof value === 'string' ? Number(value) : value
}

/** Shared body fields for creating a comment (JSON or multipart). */
export class CreateCommentRequest {
  @ApiProperty({ example: 'ابزار خوبی است', minLength: 2, maxLength: 5000 })
  @IsString()
  @MinLength(2)
  @MaxLength(5000)
  content: string

  @ApiPropertyOptional({ example: 'کیفیت عالی', maxLength: 200 })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string

  @ApiPropertyOptional({
    example: 5,
    minimum: 1,
    maximum: 5,
    description: 'Only on root comments.',
  })
  @Transform(toOptionalInt)
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rate?: number

  @ApiPropertyOptional({
    example: 12,
    description: 'Id of the root comment to reply to. Replies cannot nest further.',
  })
  @Transform(toOptionalInt)
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  parent_id?: number
}

export class ModerateCommentRequest {
  @ApiProperty({
    example: true,
    description: 'true publishes the comment; false hides it again.',
  })
  @IsBoolean()
  published: boolean
}

export class ListCommentsQueryRequest {
  @ApiPropertyOptional({ example: 20, maximum: 100 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number

  @ApiPropertyOptional({ example: 0 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number
}
