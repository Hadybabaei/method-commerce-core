import { InjectQueue } from '@nestjs/bullmq'
import { Injectable, Logger } from '@nestjs/common'
import { Queue } from 'bullmq'
import {
  CANCEL_UNPAID_ORDER_JOB,
  CancelUnpaidOrderJobData,
  OrderPaymentTimeoutScheduler,
  UNPAID_ORDER_QUEUE,
} from '../../application/ports/order-payment-timeout.port'

function jobIdFor(orderId: number): string {
  return `unpaid-order-${orderId}`
}

@Injectable()
export class BullmqOrderPaymentTimeoutScheduler implements OrderPaymentTimeoutScheduler {
  readonly isOperational = true
  private readonly logger = new Logger(BullmqOrderPaymentTimeoutScheduler.name)

  constructor(@InjectQueue(UNPAID_ORDER_QUEUE) private readonly queue: Queue) {}

  async scheduleCancelIfUnpaid(orderId: number, delayMs: number): Promise<void> {
    const jobId = jobIdFor(orderId)
    // Replace any prior delay for the same order (e.g. recreate edge cases).
    await this.queue.remove(jobId).catch(() => undefined)

    await this.queue.add(
      CANCEL_UNPAID_ORDER_JOB,
      { orderId } satisfies CancelUnpaidOrderJobData,
      {
        jobId,
        delay: delayMs,
        removeOnComplete: true,
        removeOnFail: 100,
      }
    )

    this.logger.log(`Scheduled unpaid cancel for order ${orderId} in ${delayMs}ms`)
  }

  async cancelScheduled(orderId: number): Promise<void> {
    const removed = await this.queue.remove(jobIdFor(orderId))
    if (removed) {
      this.logger.log(`Cleared unpaid-cancel job for order ${orderId}`)
    }
  }
}
