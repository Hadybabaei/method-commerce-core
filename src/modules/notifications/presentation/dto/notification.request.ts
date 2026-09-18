import { ApiPropertyOptional } from '@nestjs/swagger'
import { Transform, Type } from 'class-transformer'
import { IsBoolean, IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator'
import {
  NOTIFICATION_CONTEXTS,
  NotificationContext,
} from '../../domain/enums/notification.enums'

function toOptionalBoolean({ value }: { value: unknown }): unknown {
  if (value === '' || value === null || value === undefined) {
    return undefined
  }
  if (value === true || value === 'true' || value === '1') {
    return true
  }
  if (value === false || value === 'false' || value === '0') {
    return false
  }
  return value
}

export class ListNotificationsQueryRequest {
  @ApiPropertyOptional({ enum: NOTIFICATION_CONTEXTS, description: 'Filter by producing context.' })
  @IsOptional()
  @IsEnum(NotificationContext)
  context?: NotificationContext

  @ApiPropertyOptional({ example: false, description: 'When true, only unread rows.' })
  @Transform(toOptionalBoolean)
  @IsOptional()
  @IsBoolean()
  unread_only?: boolean

  @ApiPropertyOptional({ example: 20, minimum: 1, maximum: 100 })
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
