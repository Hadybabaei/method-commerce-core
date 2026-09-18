export enum OrderStatus {
  Pending = 'PENDING',
  Paid = 'PAID',
  Cancelled = 'CANCELLED',
  Completed = 'COMPLETED',
}

export enum OrderReservationStatus {
  None = 'NONE',
  Reserved = 'RESERVED',
  Released = 'RELEASED',
  Consumed = 'CONSUMED',
}

export enum PaymentMethod {
  CashOnDelivery = 'CASH_ON_DELIVERY',
  Online = 'ONLINE',
}

export enum PaymentStatus {
  Initiated = 'INITIATED',
  Succeeded = 'SUCCEEDED',
  Failed = 'FAILED',
}

export const ORDER_STATUSES = Object.values(OrderStatus)
export const PAYMENT_METHODS = Object.values(PaymentMethod)
export const PAYMENT_STATUSES = Object.values(PaymentStatus)
