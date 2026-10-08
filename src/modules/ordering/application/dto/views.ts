import { AddressSnapshot } from '../../domain/entities/order.aggregate'
import { OrderProductSnapshot } from '../../domain/entities/order-item.entity'
import { OrderStatus, PaymentMethod, ReturnRequestStatus } from '../../domain/enums/order.enums'

export type { AddressSnapshot, OrderProductSnapshot }

export interface OrderItemView {
  id: number
  variantId: number | null
  quantity: number
  unitPrice: number
  lineTotal: number
  /** VAT on this line; 0 for exempt goods. */
  taxAmount: number
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

export interface ReturnRequestLineView {
  orderItemId: number
  quantity: number
  title: string
  sku: string
}

export interface ReturnRequestView {
  id: number
  status: ReturnRequestStatus
  reason: string
  adminNote: string | null
  items: ReturnRequestLineView[]
  createdAt: Date
  decidedAt: Date | null
}

/** A refund paid back by bank transfer. */
export interface RefundView {
  id: number
  amount: number
  reference: string
  paidAt: Date
  restocked: boolean
  returnRequestId: number | null
  note: string | null
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
  /** VAT rate at checkout in basis points (1000 = 10%). */
  taxRateBp: number
  taxTotal: number
  /** subtotal + shippingFee + taxTotal; what the customer pays. */
  total: number
  /** Sum of refunds paid back so far. */
  refundedTotal: number
  shipping: OrderShippingView
  note: string | null
  address: AddressSnapshot
  items: OrderItemView[]
  payment: OrderPaymentView | null
  canCancel: boolean
  /** Oldest first. */
  statusHistory: OrderStatusEventView[]
  /** Oldest first. */
  returns: ReturnRequestView[]
  /** Oldest first. */
  refunds: RefundView[]
  /** Last moment a return may be requested; null unless delivered. */
  returnableUntil: Date | null
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
  taxAmount: number
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
  /** Basis points; 1000 = 10%. */
  taxRateBp: number
  taxTotal: number
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

/** A return request in the admin queue. */
export interface AdminReturnRequestView extends ReturnRequestView {
  orderId: number
  orderNumber: string
  userId: number
}

export interface PaginatedReturnRequestsView {
  items: AdminReturnRequestView[]
  total: number
  limit: number
  offset: number
}

export interface RequestReturnCommand {
  orderId: number
  userId: number
  items: { orderItemId: number; quantity: number }[]
  reason: string
}

export interface RecordRefundCommand {
  orderId: number
  adminId: number
  amount: number
  reference: string
  paidAt?: Date
  note?: string | null
  returnRequestId?: number | null
  restock?: boolean
}
