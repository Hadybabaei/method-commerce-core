import { ApiProperty } from '@nestjs/swagger'
import { PaginationMeta } from '@shared/presentation/swagger'
import {
  ORDER_STATUSES,
  OrderStatus,
  PAYMENT_METHODS,
  PaymentMethod,
} from '../../domain/enums/order.enums'
import {
  OrderItemView,
  OrderShippingView,
  OrderStatusEventView,
  OrderView,
} from '../../application/dto/views'
import { ShippingOptionResponse } from './shipping-method.response'

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

  @ApiProperty({ example: 480_000, description: 'VAT on this line in Rial; 0 for exempt goods.' })
  taxAmount: number

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

export class OrderShippingMethodResponse {
  @ApiProperty({ example: 1, description: 'May no longer exist; the order keeps this copy.' })
  id: number

  @ApiProperty({ example: 'پست پیشتاز' })
  name: string

  @ApiProperty({ example: 'post' })
  code: string

  @ApiProperty({ nullable: true, example: 2 })
  minDays: number | null

  @ApiProperty({ nullable: true, example: 5 })
  maxDays: number | null
}

export class OrderShippingResponse implements OrderShippingView {
  @ApiProperty({
    type: OrderShippingMethodResponse,
    nullable: true,
    description: 'Null when the store had no shipping methods at checkout.',
  })
  method: OrderShippingMethodResponse | null

  @ApiProperty({ example: 650_000, description: 'Rial.' })
  fee: number

  @ApiProperty({ example: 1500 })
  weightGrams: number

  @ApiProperty({ nullable: true, example: '123456789012345678901234' })
  trackingCode: string | null

  @ApiProperty({ nullable: true, example: 'https://tracking.post.ir/?id=123456789012345678901234' })
  trackingUrl: string | null
}

export class OrderStatusEventResponse implements OrderStatusEventView {
  @ApiProperty({ enum: ORDER_STATUSES, nullable: true, description: 'Null for the first event.' })
  from: OrderStatus | null

  @ApiProperty({ enum: ORDER_STATUSES, example: OrderStatus.Shipped })
  to: OrderStatus

  @ApiProperty({ nullable: true, example: 'Tracking code 123456789012345678901234' })
  note: string | null

  @ApiProperty()
  at: Date
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

  @ApiProperty({ example: 650_000, description: 'Rial.' })
  shippingFee: number

  @ApiProperty({
    example: 5_450_000,
    description: 'subtotal + shippingFee in Rial; what the customer pays.',
  })
  total: number

  @ApiProperty({ example: 1000, description: 'VAT rate at checkout in basis points (1000 = 10%).' })
  taxRateBp: number

  @ApiProperty({ example: 480_000, description: 'VAT in Rial.' })
  taxTotal: number

  @ApiProperty({ example: 0, description: 'Refunds paid back so far, in Rial.' })
  refundedTotal: number

  @ApiProperty({ type: OrderShippingResponse })
  shipping: OrderShippingResponse

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

  @ApiProperty({ type: [OrderStatusEventResponse], description: 'Oldest first.' })
  statusHistory: OrderStatusEventResponse[]

  @ApiProperty({ nullable: true })
  cancelledAt: Date | null

  @ApiProperty({ nullable: true })
  paidAt: Date | null

  @ApiProperty({ nullable: true })
  processingAt: Date | null

  @ApiProperty({ nullable: true })
  shippedAt: Date | null

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

  @ApiProperty({ example: 480_000, description: 'VAT on this line in Rial; 0 for exempt goods.' })
  taxAmount: number

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

  @ApiProperty({ example: 1500, description: 'Parcel weight used for the shipping quote.' })
  weightGrams: number

  @ApiProperty({
    type: [ShippingOptionResponse],
    description:
      'Methods that deliver to the address, cheapest first. Empty when the store has none.',
  })
  shippingMethods: ShippingOptionResponse[]

  @ApiProperty({
    nullable: true,
    example: 1,
    description: 'The method the order will use: the requested one, else the cheapest.',
  })
  shippingMethodId: number | null

  @ApiProperty({
    example: 650_000,
    description: 'Fee of the selected method in Rial; 0 when none.',
  })
  shippingFee: number

  @ApiProperty({ example: 1000, description: 'Basis points; 1000 = 10%.' })
  taxRateBp: number

  @ApiProperty({ example: 480_000, description: 'VAT in Rial; exempt products add nothing.' })
  taxTotal: number

  @ApiProperty({ example: 4_800_000, description: 'subtotal + shippingFee, in Rial.' })
  total: number

  @ApiProperty({ enum: PAYMENT_METHODS, example: PaymentMethod.CashOnDelivery })
  paymentMethod: PaymentMethod

  @ApiProperty({ nullable: true })
  note: string | null
}
