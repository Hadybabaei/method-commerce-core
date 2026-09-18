import { Inject, Injectable, Logger } from '@nestjs/common'
import { CLOCK, Clock } from '@shared/application/ports/clock.port'
import { UseCase } from '@shared/application/use-case'
import { PrismaService } from '@shared/infrastructure/persistence/prisma/prisma.service'
import { Payment } from '../../domain/entities/payment.entity'
import { Order } from '../../domain/entities/order.aggregate'
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

const PAYMENT_CALLBACK_TX_TIMEOUT_MS = 20_000

type Tx = unknown

/**
 * Completes (or fails) an online payment after the provider redirects back.
 * Success always goes through `PaymentGateway.verifyPayment` so a forged
 * callback cannot mark an order paid without a verified gateway receipt.
 *
 * A late capture against a cancelled ONLINE order re-reserves stock and
 * revives the order so money already taken at the gateway is not dropped.
 */
@Injectable()
export class HandlePaymentCallbackUseCase implements UseCase<
  HandlePaymentCallbackCommand,
  PaymentCallbackResult
> {
  private readonly logger = new Logger(HandlePaymentCallbackUseCase.name)

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
      return this.replay(payment)
    }

    const outcome = await this.prisma.$transaction(
      async (tx) => {
        const lockedPayment = await this.payments.findByIdForUpdate(payment.id, tx)
        if (!lockedPayment) {
          throw new PaymentNotFoundError(payment.id)
        }

        if (lockedPayment.status === PaymentStatus.Succeeded) {
          return { kind: 'replay' as const, payment: lockedPayment }
        }

        if (!parsed.reportedSuccess) {
          lockedPayment.markFailed('Gateway reported unsuccessful checkout', this.clock.now())
          const saved = await this.payments.save(lockedPayment, tx)
          return { kind: 'failed' as const, payment: saved }
        }

        if (lockedPayment.status === PaymentStatus.Failed) {
          return { kind: 'failed' as const, payment: lockedPayment }
        }

        const order = await this.orders.findByIdForUpdate(lockedPayment.orderId, tx)
        if (!order) {
          throw new OrderNotFoundError(lockedPayment.orderId)
        }

        const verified = await this.gateway.verifyPayment({
          gatewayRef: parsed.gatewayRef,
          expectedAmount: lockedPayment.amount,
        })

        if (!verified.ok) {
          lockedPayment.markFailed(
            verified.failureReason ?? 'Gateway verification failed',
            this.clock.now()
          )
          const saved = await this.payments.save(lockedPayment, tx)
          return { kind: 'failed' as const, payment: saved }
        }

        if (order.status === OrderStatus.Cancelled) {
          return {
          kind: 'paid' as const,
          payment: await this.captureLatePayment(order, lockedPayment, tx),
        }
      }

      if (order.status !== OrderStatus.Pending) {
        throw new OrderNotPayableError('Only a pending order can be paid', {
          status: order.status,
        })
      }

      return {
        kind: 'paid' as const,
        payment: await this.capturePendingPayment(order, lockedPayment, tx),
      }
      },
      { timeout: PAYMENT_CALLBACK_TX_TIMEOUT_MS }
    )

    if (outcome.kind === 'paid') {
      await this.paymentTimeouts.cancelScheduled(outcome.payment.orderId)
      const paidOrder = await this.orders.findById(outcome.payment.orderId)
      if (paidOrder) {
        await this.orderNotifications.paid(paidOrder)
      }
    }

    return {
      payment: toPaymentView(outcome.payment),
      order: await this.requireOrderView(outcome.payment.orderId),
    }
  }

  private async capturePendingPayment(
    order: Order,
    payment: Payment,
    tx: Tx
  ): Promise<Payment> {
    const now = this.clock.now()
    const plan = order.stockAllocations
    order.markPaid(now)
    payment.markSucceeded(now)
    await this.inventory.consume(plan, tx)
    await this.orders.saveIfStatus(order, OrderStatus.Pending, tx)
    return this.payments.save(payment, tx)
  }

  private async captureLatePayment(order: Order, payment: Payment, tx: Tx): Promise<Payment> {
    this.logger.warn(
      `Reviving cancelled order ${order.id} after verified gateway capture ${payment.gatewayRef}`
    )

    const lines = order.items.flatMap((item) =>
      item.variantId == null ? [] : [{ variantId: item.variantId, quantity: item.quantity }]
    )
    const plan = await this.inventory.reserve(lines, tx)
    order.reviveForPayment(plan)
    const now = this.clock.now()
    order.markPaid(now)
    payment.markSucceeded(now)
    await this.inventory.consume(plan, tx)
    await this.orders.saveIfStatus(order, OrderStatus.Cancelled, tx)
    return this.payments.save(payment, tx)
  }

  private async replay(payment: Payment): Promise<PaymentCallbackResult> {
    return {
      payment: toPaymentView(payment),
      order: await this.requireOrderView(payment.orderId),
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
