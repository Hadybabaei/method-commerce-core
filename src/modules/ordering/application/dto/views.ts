import { AddressSnapshot } from '../../domain/entities/order.aggregate'
import { OrderProductSnapshot } from '../../domain/entities/order-item.entity'
import { OrderStatus, PaymentMethod } from '../../domain/enums/order.enums'

export type { AddressSnapshot, OrderProductSnapshot }

export interface OrderItemView {
  id: number
  variantId: number | null
  quantity: number
  unitPrice: number
  lineTotal: number
  product: OrderProductSnapshot
}

export interface OrderView {
  id: number
  number: string
  userId: number
  status: OrderStatus
  paymentMethod: PaymentMethod
  itemCount: number
  subtotal: number
  note: string | null
  address: AddressSnapshot
  items: OrderItemView[]
  canCancel: boolean
  cancelledAt: Date | null
  paidAt: Date | null
  completedAt: Date | null
  createdAt: Date
}

export interface PaginatedOrdersView {
  items: OrderView[]
  total: number
  limit: number
  offset: number
}

export interface CreateOrderCommand {
  userId: number
  addressId: number
  paymentMethod?: PaymentMethod
  note?: string | null
}

export interface CancelOrderCommand {
  orderId: number
  /** When set, the order must belong to this customer. */
  userId?: number
}

export interface InitiatePaymentCommand {
  orderId: number
  userId: number
  idempotencyKey: string
}

export interface PaymentView {
  id: number
  orderId: number
  amount: number
  status: string
  gatewayRef: string | null
  redirectUrl: string | null
  idempotencyKey: string
}

export type PaymentCallbackStatus = 'success' | 'failed'

export interface HandlePaymentCallbackCommand {
  /** Raw provider callback query/body fields (e.g. Zibal trackId/success/status). */
  raw: Record<string, string | undefined>
}

export interface ListOrdersQuery {
  userId?: number
  status?: OrderStatus
  search?: string
  createdFrom?: Date
  createdTo?: Date
  limit?: number
  offset?: number
}
