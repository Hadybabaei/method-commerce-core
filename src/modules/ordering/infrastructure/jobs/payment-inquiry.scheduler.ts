import { InjectQueue } from '@nestjs/bullmq'
import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Queue } from 'bullmq'
import { OrderingJobsConfig } from '@config/ordering-jobs.config'
import {
  INQUIRE_OPEN_PAYMENTS_JOB,
  PAYMENT_INQUIRY_QUEUE,
  PAYMENT_INQUIRY_REPEAT_JOB_ID,
} from '../../application/ports/payment-inquiry.port'

@Injectable()
export class PaymentInquiryScheduler implements OnModuleInit {
  private readonly logger = new Logger(PaymentInquiryScheduler.name)

  constructor(
    @InjectQueue(PAYMENT_INQUIRY_QUEUE) private readonly queue: Queue,
    private readonly configService: ConfigService
  ) {}

  async onModuleInit(): Promise<void> {
    const intervalMs =
      this.configService.getOrThrow<OrderingJobsConfig>('orderingJobs').inquiryIntervalMs

    await this.queue.upsertJobScheduler(
      PAYMENT_INQUIRY_REPEAT_JOB_ID,
      { every: intervalMs },
      {
        name: INQUIRE_OPEN_PAYMENTS_JOB,
        data: {},
        opts: {
          removeOnComplete: 20,
          removeOnFail: 50,
        },
      }
    )

    this.logger.log(`Scheduled payment inquiry every ${intervalMs}ms`)
  }
}
