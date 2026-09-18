import { Inject, Injectable } from '@nestjs/common'
import { CLOCK, Clock } from '@shared/application/ports/clock.port'
import { UseCase } from '@shared/application/use-case'
import { PrismaService } from '@shared/infrastructure/persistence/prisma/prisma.service'
import { OrderStatus, PaymentStatus } from '../../domain/enums/order.enums'
import {
  OrderNotFoundError,
  OrderNotPayableError,
  PaymentNotFoundError,
} from '../../domain/errors/ordering.errors'
import {
  INVENTORY_RESERVATION,
  InventoryReservationService,
  ORDER_REPOSITORY,
  OrderRepository,
} from '../../domain/repositories/order.repository'
import {
  PAYMENT_REPOSITORY,
  PaymentRepository,
} from '../../domain/repositories/payment.repository'
import { HandlePaymentCallbackCommand, OrderView } from '../dto/views'
import {
  ORDER_PAYMENT_TIMEOUT_SCHEDULER,
  OrderPaymentTimeoutScheduler,
} from '../ports/order-payment-timeout.port'
import { ORDER_READ_MODEL, OrderReadModel } from '../ports/order-read.port'
import { PAYMENT_GATEWAY, PaymentGateway } from '../ports/payment-gateway.port'
import { toPaymentView } from './initiate-payment.use-case'
import { OrderNotificationService } from '../order-notification.service'

export interface PaymentCallbackResult {
  payment: ReturnType<typeof toPaymentView>
  order: OrderView
}

/**
 * Completes (or fails) an online payment after the provider redirects back.
 * Success always goes through `PaymentGateway.verifyPayment` so a forged
 * callback cannot mark an order paid without a verified gateway receipt.
 */
@Injectable()
export class HandlePaymentCallbackUseCase implements UseCase<
  HandlePaymentCallbackCommand,
  PaymentCallbackResult
> {
  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepository,
    @Inject(PAYMENT_REPOSITORY) private readonly payments: PaymentRepository,
    @Inject(ORDER_READ_MODEL) private readonly orderReads: OrderReadModel,
    @Inject(INVENTORY_RESERVATION) private readonly inventory: InventoryReservationService,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
    @Inject(ORDER_PAYMENT_TIMEOUT_SCHEDULER)
    private readonly paymentTimeouts: OrderPaymentTimeoutScheduler,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly prisma: PrismaService,
    private readonly orderNotifications: OrderNotificationService
  ) {}

  async execute(command: HandlePaymentCallbackCommand): Promise<PaymentCallbackResult> {
    const parsed = this.gateway.parseCallback(command.raw)
    const payment = await this.payments.findByGatewayRef(parsed.gatewayRef)

    if (!payment) {
      throw new PaymentNotFoundError(parsed.gatewayRef)
    }

    if (payment.status === PaymentStatus.Succeeded) {
      return {
        payment: toPaymentView(payment),
        order: await this.requireOrderView(payment.orderId),
      }
    }

    if (!parsed.reportedSuccess) {
      payment.markFailed('Gateway reported unsuccessful checkout', this.clock.now())
      const saved = await this.payments.save(payment)
      return {
        payment: toPaymentView(saved),
        order: await this.requireOrderView(saved.orderId),
      }
    }

    const verified = await this.gateway.verifyPayment({
      gatewayRef: parsed.gatewayRef,
      expectedAmount: payment.amount,
    })

    if (!verified.ok) {
      payment.markFailed(verified.failureReason ?? 'Gateway verification failed', this.clock.now())
      const saved = await this.payments.save(payment)
      return {
        payment: toPaymentView(saved),
        order: await this.requireOrderView(saved.orderId),
      }
    }

    const order = await this.orders.findById(payment.orderId)
    if (!order) {
      throw new OrderNotFoundError(payment.orderId)
    }

    if (order.status !== OrderStatus.Pending) {
      throw new OrderNotPayableError('Only a pending order can be paid', {
        status: order.status,
      })
    }

    const now = this.clock.now()
    order.markPaid(now)
    payment.markSucceeded(now)
    const plan = order.stockAllocations

    await this.prisma.$transaction(async (tx) => {
      await this.inventory.consume(plan, tx)
      await this.orders.save(order, tx)
      await this.payments.save(payment, tx)
    })

    await this.paymentTimeouts.cancelScheduled(order.id)

    await this.orderNotifications.paid(order)

    const savedPayment = await this.payments.findById(payment.id)
    return {
      payment: toPaymentView(savedPayment ?? payment),
      order: await this.requireOrderView(order.id),
    }
  }

  private async requireOrderView(orderId: number): Promise<OrderView> {
    const view = await this.orderReads.findById(orderId)
    if (!view) {
      throw new OrderNotFoundError(orderId)
    }
    return view
  }
}
