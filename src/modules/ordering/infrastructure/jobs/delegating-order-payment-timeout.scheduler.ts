import { Injectable } from '@nestjs/common'
import { ModuleRef } from '@nestjs/core'
import {
  BULLMQ_ORDER_PAYMENT_TIMEOUT_SCHEDULER,
  OrderPaymentTimeoutScheduler,
} from '../../application/ports/order-payment-timeout.port'
import { isOrderingJobsEnabled } from '../../ordering-jobs.enabled'
import { NoopOrderPaymentTimeoutScheduler } from './noop-order-payment-timeout.scheduler'

/**
 * OrderingModule always injects this token. When Redis/jobs are on, the first
 * call switches to the BullMQ adapter from OrderingJobsModule; otherwise it
 * stays a no-op and ONLINE checkout is refused.
 */
@Injectable()
export class DelegatingOrderPaymentTimeoutScheduler implements OrderPaymentTimeoutScheduler {
  private inner: OrderPaymentTimeoutScheduler = new NoopOrderPaymentTimeoutScheduler()
  private resolved = false

  constructor(private readonly moduleRef: ModuleRef) {}

  get isOperational(): boolean {
    return this.resolve().isOperational
  }

  async scheduleCancelIfUnpaid(orderId: number, delayMs: number): Promise<void> {
    return this.resolve().scheduleCancelIfUnpaid(orderId, delayMs)
  }

  async cancelScheduled(orderId: number): Promise<void> {
    return this.resolve().cancelScheduled(orderId)
  }

  private resolve(): OrderPaymentTimeoutScheduler {
    if (this.resolved || !isOrderingJobsEnabled()) {
      return this.inner
    }

    this.resolved = true
    try {
      const bull = this.moduleRef.get<OrderPaymentTimeoutScheduler>(
        BULLMQ_ORDER_PAYMENT_TIMEOUT_SCHEDULER,
        { strict: false }
      )
      if (bull) {
        this.inner = bull
      }
    } catch {
      // Jobs module is not in the graph.
    }

    return this.inner
  }
}
