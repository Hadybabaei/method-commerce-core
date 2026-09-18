import { Inject, Injectable } from '@nestjs/common'
import { UseCase } from '@shared/application/use-case'
import { PrismaService } from '@shared/infrastructure/persistence/prisma/prisma.service'
import { OrderNotFoundError } from '../../domain/errors/ordering.errors'
import {
  INVENTORY_RESERVATION,
  InventoryReservationService,
  ORDER_REPOSITORY,
  OrderRepository,
} from '../../domain/repositories/order.repository'
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
    @Inject(ORDER_PAYMENT_TIMEOUT_SCHEDULER)
    private readonly paymentTimeouts: OrderPaymentTimeoutScheduler,
    private readonly orderNotifications: OrderNotificationService,
    private readonly prisma: PrismaService
  ) {}

  async execute(command: CancelOrderCommand): Promise<OrderView> {
    const order = await this.orders.findById(command.orderId)
    if (!order) {
      throw new OrderNotFoundError(command.orderId)
    }

    if (command.userId !== undefined) {
      order.ensureOwnedBy(command.userId)
    }

    const plan = order.stockAllocations
    order.cancel()

    await this.prisma.$transaction(async (tx) => {
      if (plan.allocations.length > 0) {
        await this.inventory.release(plan, tx)
      }
      await this.orders.save(order, tx)
    })

    await this.paymentTimeouts.cancelScheduled(order.id)

    const view = await this.orderReads.findById(order.id)
    if (!view) {
      throw new OrderNotFoundError(order.id)
    }

    await this.orderNotifications.cancelled(order)

    return view
  }
}
