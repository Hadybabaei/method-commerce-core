import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { Job } from 'bullmq'
import { PaymentMethod } from '../../domain/enums/order.enums'
import { OrderNotCancellableError, OrderNotFoundError } from '../../domain/errors/ordering.errors'
import { ORDER_REPOSITORY, OrderRepository } from '../../domain/repositories/order.repository'
import { CancelOrderUseCase } from '../../application/use-cases/cancel-order.use-case'
import {
  CANCEL_UNPAID_ORDER_JOB,
  CancelUnpaidOrderJobData,
  UNPAID_ORDER_QUEUE,
} from '../../application/ports/order-payment-timeout.port'

/**
 * Fires 15 minutes (configurable) after an ONLINE checkout. Cancels only if
 * the order is still PENDING — paid / already-cancelled orders are skipped.
 */
@Processor(UNPAID_ORDER_QUEUE)
@Injectable()
export class CancelUnpaidOrderProcessor extends WorkerHost {
  private readonly logger = new Logger(CancelUnpaidOrderProcessor.name)

  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepository,
    private readonly cancelOrder: CancelOrderUseCase
  ) {
    super()
  }

  async process(job: Job<CancelUnpaidOrderJobData>): Promise<void> {
    if (job.name !== CANCEL_UNPAID_ORDER_JOB) {
      return
    }

    const { orderId } = job.data
    const order = await this.orders.findById(orderId)

    if (!order) {
      this.logger.warn(`Unpaid-cancel skipped: order ${orderId} not found`)
      return
    }

    if (order.paymentMethod !== PaymentMethod.Online) {
      return
    }

    if (!order.canCancel) {
      this.logger.debug(`Unpaid-cancel skipped: order ${orderId} status=${order.status}`)
      return
    }

    try {
      await this.cancelOrder.execute({ orderId })
      this.logger.log(`Auto-cancelled unpaid order ${orderId}`)
    } catch (error) {
      if (error instanceof OrderNotCancellableError || error instanceof OrderNotFoundError) {
        this.logger.debug(`Unpaid-cancel race for order ${orderId}: ${error.message}`)
        return
      }
      throw error
    }
  }
}
