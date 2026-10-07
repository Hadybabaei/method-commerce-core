import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Inject, Injectable } from '@nestjs/common'
import { Job } from 'bullmq'
import { SMS_SENDER, SmsSender } from '@shared/application/ports/sms-sender.port'
import {
  ORDER_SMS_QUEUE,
  OrderSms,
  SEND_ORDER_SMS_JOB,
} from '../../application/ports/order-sms.port'

/** Throws on provider errors so BullMQ retries with backoff. */
@Processor(ORDER_SMS_QUEUE)
@Injectable()
export class SendOrderSmsProcessor extends WorkerHost {
  constructor(@Inject(SMS_SENDER) private readonly sms: SmsSender) {
    super()
  }

  async process(job: Job<OrderSms>): Promise<void> {
    if (job.name !== SEND_ORDER_SMS_JOB) {
      return
    }
    await this.sms.send(job.data.phoneNumber, job.data.text)
  }
}
