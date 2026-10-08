import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDate,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator'
import { MAX_MONEY_AMOUNT } from '@shared/domain/value-objects/money'
import { PaginationMeta } from '@shared/presentation/swagger'
import { RETURN_REQUEST_STATUSES, ReturnRequestStatus } from '../../domain/enums/order.enums'
import {
  AdminReturnRequestView,
  RefundView,
  ReturnRequestLineView,
  ReturnRequestView,
} from '../../application/dto/views'

class ReturnLineRequest {
  @ApiProperty({ example: 21, description: 'An order line id from the order.' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  order_item_id: number

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number
}

export class RequestReturnRequest {
  @ApiProperty({ type: [ReturnLineRequest] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ReturnLineRequest)
  items: ReturnLineRequest[]

  @ApiProperty({ example: 'سایز مناسب نبود', minLength: 3, maxLength: 1000 })
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  reason: string
}

export class ApproveReturnRequest {
  @ApiPropertyOptional({ example: 'کالا را با پست پیشتاز ارسال کنید', maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string
}

export class RejectReturnRequest {
  @ApiProperty({ example: 'مهلت مرجوعی گذشته است', maxLength: 1000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  note: string
}

export class RecordRefundRequest {
  @ApiProperty({
    example: 2_200_000,
    description: 'Rial paid back. Total refunds cannot exceed the order total.',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_MONEY_AMOUNT)
  amount: number

  @ApiProperty({ example: '140210081234', description: 'Bank transfer reference (شماره پیگیری).' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  reference: string

  @ApiPropertyOptional({ description: 'When the transfer was made. Defaults to now.' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  paid_at?: Date

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string

  @ApiPropertyOptional({ example: 3, description: 'An approved return this refund settles.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  return_request_id?: number

  @ApiPropertyOptional({
    default: false,
    description: 'Put the returned units back on hand. Needs return_request_id.',
  })
  @IsOptional()
  @IsBoolean()
  restock?: boolean
}

export class ListReturnRequestsQuery {
  @ApiPropertyOptional({ enum: RETURN_REQUEST_STATUSES })
  @IsOptional()
  @IsEnum(ReturnRequestStatus)
  status?: ReturnRequestStatus

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

export class ReturnRequestLineResponse implements ReturnRequestLineView {
  @ApiProperty() orderItemId: number
  @ApiProperty() quantity: number
  @ApiProperty() title: string
  @ApiProperty() sku: string
}

export class ReturnRequestResponse implements ReturnRequestView {
  @ApiProperty() id: number
  @ApiProperty({ enum: RETURN_REQUEST_STATUSES }) status: ReturnRequestStatus
  @ApiProperty() reason: string
  @ApiProperty({ nullable: true }) adminNote: string | null
  @ApiProperty({ type: [ReturnRequestLineResponse] }) items: ReturnRequestLineResponse[]
  @ApiProperty() createdAt: Date
  @ApiProperty({ nullable: true }) decidedAt: Date | null
}

export class RefundResponse implements RefundView {
  @ApiProperty() id: number
  @ApiProperty({ description: 'Rial.' }) amount: number
  @ApiProperty({ description: 'Bank transfer reference.' }) reference: string
  @ApiProperty() paidAt: Date
  @ApiProperty() restocked: boolean
  @ApiProperty({ nullable: true }) returnRequestId: number | null
  @ApiProperty({ nullable: true }) note: string | null
}

export class AdminReturnRequestResponse
  extends ReturnRequestResponse
  implements AdminReturnRequestView
{
  @ApiProperty() orderId: number
  @ApiProperty({ example: 'ORD-20261008-00001' }) orderNumber: string
  @ApiProperty() userId: number
}

export class PaginatedReturnRequestsResponse extends PaginationMeta {
  @ApiProperty({ type: [AdminReturnRequestResponse] })
  items: AdminReturnRequestResponse[]
}
