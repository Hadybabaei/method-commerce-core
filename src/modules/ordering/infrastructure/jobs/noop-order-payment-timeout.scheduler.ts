import { Injectable } from '@nestjs/common'
import { OrderPaymentTimeoutScheduler } from '../../application/ports/order-payment-timeout.port'

/** Used when Redis/BullMQ is disabled (tests, local without Redis). */
@Injectable()
export class NoopOrderPaymentTimeoutScheduler implements OrderPaymentTimeoutScheduler {
  readonly isOperational = false

  async scheduleCancelIfUnpaid(): Promise<void> {
    /* no-op */
  }

  async cancelScheduled(): Promise<void> {
    /* no-op */
  }
}
