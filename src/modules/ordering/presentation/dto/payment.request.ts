import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsOptional, IsString, MaxLength } from 'class-validator'

/**
 * Zibal redirects here with query params:
 * `?trackId=…&success=1&status=2&orderId=…`
 */
export class PaymentCallbackQuery {
  @ApiPropertyOptional({ example: '15966442233311', description: 'Zibal trackId' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  trackId?: string

  @ApiPropertyOptional({ example: '1', description: '1 = success attempt' })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  success?: string

  @ApiPropertyOptional({ example: '2', description: '2 = paid (Zibal)' })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  status?: string

  @ApiPropertyOptional({ example: 'checkout-attempt-1' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  orderId?: string
}
