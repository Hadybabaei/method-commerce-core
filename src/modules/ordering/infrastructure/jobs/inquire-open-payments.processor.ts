import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Injectable, Logger } from '@nestjs/common'
import { Job } from 'bullmq'
import {
  INQUIRE_OPEN_PAYMENTS_JOB,
  INQUIRE_OPEN_PAYMENTS_WORKER_OPTIONS,
  PAYMENT_INQUIRY_QUEUE,
} from '../../application/ports/payment-inquiry.port'
import { InquireOpenPaymentsUseCase } from '../../application/use-cases/inquire-open-payments.use-case'

@Processor(PAYMENT_INQUIRY_QUEUE, INQUIRE_OPEN_PAYMENTS_WORKER_OPTIONS)
@Injectable()
export class InquireOpenPaymentsProcessor extends WorkerHost {
  private readonly logger = new Logger(InquireOpenPaymentsProcessor.name)

  constructor(private readonly inquireOpenPayments: InquireOpenPaymentsUseCase) {
    super()
  }

  async process(job: Job): Promise<void> {
    if (job.name !== INQUIRE_OPEN_PAYMENTS_JOB) {
      return
    }

    this.logger.debug('Inquiring open online payments')
    await this.inquireOpenPayments.execute()
  }
}
