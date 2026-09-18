import { ApiProperty } from '@nestjs/swagger'
import { PaginationMeta } from '@shared/presentation/swagger'
import {
  ORDER_STATUSES,
  OrderStatus,
  PAYMENT_METHODS,
  PaymentMethod,
} from '../../domain/enums/order.enums'
import { OrderItemView, OrderView } from '../../application/dto/views'

export class OrderProductSnapshotResponse {
  @ApiProperty({ example: 1 })
  productId: number

  @ApiProperty({ example: 11 })
  variantId: number

  @ApiProperty({ example: 'دریل شارژی بوش' })
  title: string

  @ApiProperty({ example: 'دریل-شارژی-بوش' })
  slug: string

  @ApiProperty({ example: 'DRL-RED-L' })
  sku: string

  @ApiProperty({ example: [{ option: 'رنگ', value: 'قرمز' }] })
  options: { option: string; value: string }[]

  @ApiProperty({ nullable: true })
  image: string | null

  @ApiProperty({ nullable: true })
  thumbnail: string | null
}

export class OrderAddressResponse {
  @ApiProperty({ example: 3 })
  id: number

  @ApiProperty({ example: 'خانه' })
  title: string

  @ApiProperty()
  province: { id: number; name: string; slug: string; telPrefix: string }

  @ApiProperty()
  city: { id: number; name: string; slug: string; provinceId: number }

  @ApiProperty()
  hood: string

  @ApiProperty()
  postalCode: string

  @ApiProperty()
  pelak: string

  @ApiProperty({ nullable: true })
  vahed: string | null

  @ApiProperty()
  details: string

  @ApiProperty()
  receiver: {
    isAccountOwner: boolean
    fullName: string | null
    phoneNumber: string | null
  }

  @ApiProperty({ nullable: true })
  location: { latitude: number; longitude: number } | null
}

export class OrderItemResponse implements OrderItemView {
  @ApiProperty({ example: 1 })
  id: number

  @ApiProperty({ example: 11, nullable: true })
  variantId: number | null

  @ApiProperty({ example: 2 })
  quantity: number

  @ApiProperty({ example: 2_400_000 })
  unitPrice: number

  @ApiProperty({ example: 4_800_000 })
  lineTotal: number

  @ApiProperty({ type: OrderProductSnapshotResponse })
  product: OrderProductSnapshotResponse
}

export class OrderPaymentResponse {
  @ApiProperty({ example: 1 })
  id: number

  @ApiProperty({ example: 'SUCCEEDED' })
  status: string

  @ApiProperty({ example: false })
  requiresRefund: boolean

  @ApiProperty({ nullable: true })
  failureReason: string | null

  @ApiProperty({ nullable: true })
  gatewayRef: string | null
}

export class OrderResponse implements OrderView {
  @ApiProperty({ example: 9 })
  id: number

  @ApiProperty({ example: 'ORD-20260911-00001' })
  number: string

  @ApiProperty({ example: 4 })
  userId: number

  @ApiProperty({ enum: ORDER_STATUSES, example: OrderStatus.Pending })
  status: OrderStatus

  @ApiProperty({ enum: PAYMENT_METHODS, example: PaymentMethod.CashOnDelivery })
  paymentMethod: PaymentMethod

  @ApiProperty({ example: 2 })
  itemCount: number

  @ApiProperty({ example: 4_800_000, description: 'Sum of line totals in Rial.' })
  subtotal: number

  @ApiProperty({ nullable: true })
  note: string | null

  @ApiProperty({ type: OrderAddressResponse })
  address: OrderAddressResponse

  @ApiProperty({ type: [OrderItemResponse] })
  items: OrderItemResponse[]

  @ApiProperty({ type: OrderPaymentResponse, nullable: true })
  payment: OrderPaymentResponse | null

  @ApiProperty({ example: true })
  canCancel: boolean

  @ApiProperty({ nullable: true })
  cancelledAt: Date | null

  @ApiProperty({ nullable: true })
  paidAt: Date | null

  @ApiProperty({ nullable: true })
  completedAt: Date | null

  @ApiProperty()
  createdAt: Date
}

export class PaginatedOrdersResponse extends PaginationMeta {
  @ApiProperty({ type: [OrderResponse] })
  items: OrderResponse[]
}

export class CheckoutPreviewItemResponse {
  @ApiProperty({ example: 11 })
  variantId: number

  @ApiProperty({ example: 2 })
  quantity: number

  @ApiProperty({ example: 2_400_000 })
  unitPrice: number

  @ApiProperty({ example: 4_800_000 })
  lineTotal: number

  @ApiProperty({ type: OrderProductSnapshotResponse })
  product: OrderProductSnapshotResponse
}

export class CheckoutPreviewResponse {
  @ApiProperty({ type: OrderAddressResponse })
  address: OrderAddressResponse

  @ApiProperty({ type: [CheckoutPreviewItemResponse] })
  items: CheckoutPreviewItemResponse[]

  @ApiProperty({ example: 2 })
  itemCount: number

  @ApiProperty({ example: 4_800_000, description: 'Sum of line totals in Rial.' })
  subtotal: number

  @ApiProperty({
    example: 0,
    description: 'Reserved for a future shipping quote. Currently always 0.',
  })
  shippingFee: number

  @ApiProperty({ example: 4_800_000, description: 'subtotal + shippingFee, in Rial.' })
  total: number

  @ApiProperty({ enum: PAYMENT_METHODS, example: PaymentMethod.CashOnDelivery })
  paymentMethod: PaymentMethod

  @ApiProperty({ nullable: true })
  note: string | null
}
