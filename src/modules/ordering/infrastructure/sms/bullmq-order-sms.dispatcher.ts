import { InjectQueue } from '@nestjs/bullmq'
import { Injectable, Logger } from '@nestjs/common'
import { Queue } from 'bullmq'
import {
  ORDER_SMS_QUEUE,
  OrderSms,
  OrderSmsDispatcher,
  SEND_ORDER_SMS_JOB,
} from '../../application/ports/order-sms.port'

const ATTEMPTS = 5
const FIRST_RETRY_DELAY_MS = 30_000

@Injectable()
export class BullmqOrderSmsDispatcher implements OrderSmsDispatcher {
  private readonly logger = new Logger(BullmqOrderSmsDispatcher.name)

  constructor(@InjectQueue(ORDER_SMS_QUEUE) private readonly queue: Queue) {}

  async dispatch(sms: OrderSms): Promise<void> {
    try {
      await this.queue.add(SEND_ORDER_SMS_JOB, sms, {
        attempts: ATTEMPTS,
        backoff: { type: 'exponential', delay: FIRST_RETRY_DELAY_MS },
        removeOnComplete: true,
        removeOnFail: 100,
      })
    } catch (error) {
      this.logger.error(
        `Could not queue order SMS for order ${sms.orderId}`,
        error instanceof Error ? error.stack : undefined
      )
    }
  }
}
