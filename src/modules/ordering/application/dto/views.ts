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

export interface OrderPaymentView {
  id: number
  status: string
  requiresRefund: boolean
  failureReason: string | null
  gatewayRef: string | null
}

/** A shipping method as offered at checkout, with its fee for this basket. */
export interface ShippingOptionView {
  id: number
  name: string
  code: string
  description: string | null
  fee: number
  minDays: number | null
  maxDays: number | null
}

export interface OrderShippingView {
  /** Null when the store had no shipping methods configured at checkout. */
  method: {
    id: number
    name: string
    code: string
    minDays: number | null
    maxDays: number | null
  } | null
  fee: number
  weightGrams: number
  trackingCode: string | null
  trackingUrl: string | null
}

export interface OrderStatusEventView {
  from: OrderStatus | null
  to: OrderStatus
  note: string | null
  at: Date
}

export interface OrderView {
  id: number
  number: string
  userId: number
  status: OrderStatus
  paymentMethod: PaymentMethod
  itemCount: number
  subtotal: number
  shippingFee: number
  /** subtotal + shippingFee; what the customer pays. */
  total: number
  shipping: OrderShippingView
  note: string | null
  address: AddressSnapshot
  items: OrderItemView[]
  payment: OrderPaymentView | null
  canCancel: boolean
  /** Oldest first. */
  statusHistory: OrderStatusEventView[]
  cancelledAt: Date | null
  paidAt: Date | null
  processingAt: Date | null
  shippedAt: Date | null
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
  /** Omitted = the cheapest method that delivers to the address. */
  shippingMethodId?: number | null
  note?: string | null
}

export interface CheckoutPreviewItemView {
  variantId: number
  quantity: number
  unitPrice: number
  lineTotal: number
  product: OrderProductSnapshot
}

export interface CheckoutPreviewView {
  address: AddressSnapshot
  items: CheckoutPreviewItemView[]
  itemCount: number
  subtotal: number
  weightGrams: number
  /** Methods that deliver to the address, cheapest first. Empty when the store has none. */
  shippingMethods: ShippingOptionView[]
  /** The method the order will use; null when the store has none. */
  shippingMethodId: number | null
  shippingFee: number
  total: number
  paymentMethod: PaymentMethod
  note: string | null
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
  requiresRefund: boolean
  failureReason: string | null
}

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

/** Admin view of a shipping method. Money in Rial. */
export interface ShippingMethodView {
  id: number
  name: string
  code: string
  description: string | null
  baseFee: number
  perKgFee: number
  freeAbove: number | null
  minDays: number | null
  maxDays: number | null
  provinceIds: number[] | null
  trackingUrlTemplate: string | null
  isActive: boolean
  position: number
}
