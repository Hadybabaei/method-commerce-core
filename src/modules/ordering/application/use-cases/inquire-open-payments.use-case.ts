import { Inject, Injectable, Logger } from '@nestjs/common'
import { CLOCK, Clock } from '@shared/application/ports/clock.port'
import { UseCase } from '@shared/application/use-case'
import {
  ORDER_REPOSITORY,
  OrderRepository,
} from '../../domain/repositories/order.repository'
import {
  PAYMENT_REPOSITORY,
  PaymentRepository,
} from '../../domain/repositories/payment.repository'
import {
  PAYMENT_INQUIRY_BATCH_LIMIT,
  isPaymentInquiryCandidate,
} from '../../domain/payment-inquiry'
import { HandlePaymentCallbackUseCase } from './handle-payment-callback.use-case'

/**
 * Settles captures the browser never came back for: verifies recent
 * INITIATED/FAILED sessions with the gateway, and retries fulfillment for
 * SUCCEEDED rows whose order is still PENDING or CANCELLED.
 */
@Injectable()
export class InquireOpenPaymentsUseCase implements UseCase<void, void> {
  private readonly logger = new Logger(InquireOpenPaymentsUseCase.name)
  private running = false

  constructor(
    @Inject(PAYMENT_REPOSITORY) private readonly payments: PaymentRepository,
    @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly handleCallback: HandlePaymentCallbackUseCase
  ) {}

  async execute(): Promise<void> {
    if (this.running) {
      this.logger.debug('Inquiry already in flight; skipping overlapping tick')
      return
    }

    this.running = true
    try {
      await this.inquireBatch()
    } finally {
      this.running = false
    }
  }

  private async inquireBatch(): Promise<void> {
    const now = this.clock.now()
    const open = await this.payments.listOpenForInquiry(PAYMENT_INQUIRY_BATCH_LIMIT, now)

    for (const payment of open) {
      try {
        const order = await this.orders.findById(payment.orderId)
        if (!order || !isPaymentInquiryCandidate(payment, order, now)) {
          continue
        }

        const result = await this.handleCallback.inquire(payment)
        if (result) {
          this.logger.log(
            `Inquiry settled payment ${payment.id} order ${payment.orderId} state=${result.state}`
          )
        }
      } catch (error) {
        this.logger.warn(
          `Inquiry skipped payment ${payment.id}: ${
            error instanceof Error ? error.message : String(error)
          }`
        )
      }
    }
  }
}
