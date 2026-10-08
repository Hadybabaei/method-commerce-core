export interface OrderSms {
  orderId: number
  phoneNumber: string
  text: string
}

/**
 * Sends order status texts to customers. With Redis on, messages go through a
 * BullMQ queue with retries; otherwise they are sent inline. Either way a
 * failed SMS never fails the order operation that triggered it.
 */
export interface OrderSmsDispatcher {
  dispatch(sms: OrderSms): Promise<void>
}

export const ORDER_SMS_DISPATCHER = Symbol('OrderSmsDispatcher')

/** Bound only by OrderingJobsModule — the ordering module resolves it lazily. */
export const BULLMQ_ORDER_SMS_DISPATCHER = Symbol('BullmqOrderSmsDispatcher')

export const ORDER_SMS_QUEUE = 'order-sms'
export const SEND_ORDER_SMS_JOB = 'send-order-sms'
