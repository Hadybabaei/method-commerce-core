import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsDate, IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator'
import {
  ORDER_STATUSES,
  OrderStatus,
  PAYMENT_METHODS,
  PaymentMethod,
} from '../../domain/enums/order.enums'

export class CreateOrderRequest {
  @ApiProperty({ example: 3, description: 'Delivery address id owned by the signed-in customer.' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  address_id: number

  @ApiPropertyOptional({
    enum: PAYMENT_METHODS,
    default: PaymentMethod.CashOnDelivery,
  })
  @IsOptional()
  @IsEnum(PaymentMethod)
  payment_method?: PaymentMethod

  @ApiPropertyOptional({ example: 'لطفا عصر تحویل دهید', maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string
}

export class ListOrdersQueryRequest {
  @ApiPropertyOptional({ enum: ORDER_STATUSES })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus

  @ApiPropertyOptional({
    example: 'ORD-20260911',
    description: 'Matches the order number.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  search?: string

  @ApiPropertyOptional({ example: '2026-09-01T00:00:00.000Z' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  created_from?: Date

  @ApiPropertyOptional({ example: '2026-09-30T23:59:59.000Z' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  created_to?: Date

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

export class AdminListOrdersQueryRequest extends ListOrdersQueryRequest {
  @ApiPropertyOptional({ example: 4, description: 'Filter by customer id.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  user_id?: number
}
