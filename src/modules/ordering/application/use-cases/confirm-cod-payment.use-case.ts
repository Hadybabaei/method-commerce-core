import { Inject, Injectable } from '@nestjs/common'
import { CLOCK, Clock } from '@shared/application/ports/clock.port'
import { UseCase } from '@shared/application/use-case'
import { PrismaService } from '@shared/infrastructure/persistence/prisma/prisma.service'
import { OrderStatus } from '../../domain/enums/order.enums'
import { OrderNotFoundError } from '../../domain/errors/ordering.errors'
import {
  INVENTORY_RESERVATION,
  InventoryReservationService,
  ORDER_REPOSITORY,
  OrderRepository,
} from '../../domain/repositories/order.repository'
import { OrderView } from '../dto/views'
import { ORDER_READ_MODEL, OrderReadModel } from '../ports/order-read.port'
import { OrderNotificationService } from '../order-notification.service'

@Injectable()
export class ConfirmCodPaymentUseCase implements UseCase<{ orderId: number }, OrderView> {
  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepository,
    @Inject(ORDER_READ_MODEL) private readonly orderReads: OrderReadModel,
    @Inject(INVENTORY_RESERVATION) private readonly inventory: InventoryReservationService,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly orderNotifications: OrderNotificationService,
    private readonly prisma: PrismaService
  ) {}

  async execute(command: { orderId: number }): Promise<OrderView> {
    const order = await this.orders.findById(command.orderId)
    if (!order) {
      throw new OrderNotFoundError(command.orderId)
    }

    const alreadyPaid = order.status === OrderStatus.Paid
    const plan = order.stockAllocations
    order.confirmCashOnDelivery(this.clock.now())

    await this.prisma.$transaction(async (tx) => {
      if (!alreadyPaid) {
        await this.inventory.consume(plan, tx)
      }
      await this.orders.save(order, tx)
    })

    const view = await this.orderReads.findById(order.id)
    if (!view) {
      throw new OrderNotFoundError(order.id)
    }

    if (!alreadyPaid) {
      await this.orderNotifications.paid(order)
    }

    return view
  }
}
