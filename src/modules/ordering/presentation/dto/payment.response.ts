import { ApiProperty } from '@nestjs/swagger'
import { PAYMENT_STATUSES, PaymentStatus } from '../../domain/enums/order.enums'
import { OrderResponse } from './order.response'

export class PaymentResponse {
  @ApiProperty({ example: 1 })
  id: number

  @ApiProperty({ example: 9 })
  orderId: number

  @ApiProperty({ example: 2_000_000, description: 'Amount in Rial.' })
  amount: number

  @ApiProperty({ enum: PAYMENT_STATUSES, example: PaymentStatus.Initiated })
  status: string

  @ApiProperty({ example: 'pay_abc123', nullable: true })
  gatewayRef: string | null

  @ApiProperty({
    example: 'http://localhost:4000/payments/stub-checkout?ref=pay_abc123',
    nullable: true,
  })
  redirectUrl: string | null

  @ApiProperty({ example: 'checkout-attempt-1' })
  idempotencyKey: string
}

export class PaymentCallbackResponse {
  @ApiProperty({ type: PaymentResponse })
  payment: PaymentResponse

  @ApiProperty({ type: OrderResponse })
  order: OrderResponse
}
