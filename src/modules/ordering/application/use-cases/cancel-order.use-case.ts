import { Inject, Injectable } from '@nestjs/common'
import { UseCase } from '@shared/application/use-case'
import { PrismaService } from '@shared/infrastructure/persistence/prisma/prisma.service'
import { OrderStatus, PaymentStatus } from '../../domain/enums/order.enums'
import { OrderNotCancellableError, OrderNotFoundError } from '../../domain/errors/ordering.errors'
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
import { CancelOrderCommand, OrderView } from '../dto/views'
import {
  ORDER_PAYMENT_TIMEOUT_SCHEDULER,
  OrderPaymentTimeoutScheduler,
} from '../ports/order-payment-timeout.port'
import { ORDER_READ_MODEL, OrderReadModel } from '../ports/order-read.port'
import { OrderNotificationService } from '../order-notification.service'

@Injectable()
export class CancelOrderUseCase implements UseCase<CancelOrderCommand, OrderView> {
  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepository,
    @Inject(ORDER_READ_MODEL) private readonly orderReads: OrderReadModel,
    @Inject(INVENTORY_RESERVATION) private readonly inventory: InventoryReservationService,
    @Inject(PAYMENT_REPOSITORY) private readonly payments: PaymentRepository,
    @Inject(ORDER_PAYMENT_TIMEOUT_SCHEDULER)
    private readonly paymentTimeouts: OrderPaymentTimeoutScheduler,
    private readonly orderNotifications: OrderNotificationService,
    private readonly prisma: PrismaService
  ) {}

  async execute(command: CancelOrderCommand): Promise<OrderView> {
    const cancelled = await this.prisma.$transaction(async (tx) => {
      const order = await this.orders.findByIdForUpdate(command.orderId, tx)
      if (!order) {
        throw new OrderNotFoundError(command.orderId)
      }

      if (command.userId !== undefined) {
        order.ensureOwnedBy(command.userId)
      }

      const captured = await this.payments.findInFlightByOrderId(order.id, tx)
      if (captured?.status === PaymentStatus.Succeeded) {
        throw new OrderNotCancellableError(order.status, { reason: 'payment_captured' })
      }

      const plan = order.stockAllocations
      order.cancel()

      if (plan.allocations.length > 0) {
        await this.inventory.release(plan, tx)
      }
      return this.orders.saveIfStatus(order, OrderStatus.Pending, tx)
    })

    await this.paymentTimeouts.cancelScheduled(cancelled.id)

    const view = await this.orderReads.findById(cancelled.id)
    if (!view) {
      throw new OrderNotFoundError(cancelled.id)
    }

    await this.orderNotifications.cancelled(cancelled)

    return view
  }
}
