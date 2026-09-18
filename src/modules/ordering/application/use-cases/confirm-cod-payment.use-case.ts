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
    const { order, justPaid } = await this.prisma.$transaction(async (tx) => {
      const locked = await this.orders.findByIdForUpdate(command.orderId, tx)
      if (!locked) {
        throw new OrderNotFoundError(command.orderId)
      }

      if (locked.status === OrderStatus.Paid) {
        return { order: locked, justPaid: false }
      }

      const plan = locked.stockAllocations
      locked.confirmCashOnDelivery(this.clock.now())
      await this.inventory.consume(plan, tx)
      const saved = await this.orders.saveIfStatus(locked, OrderStatus.Pending, tx)
      return { order: saved, justPaid: true }
    })

    const view = await this.orderReads.findById(order.id)
    if (!view) {
      throw new OrderNotFoundError(order.id)
    }

    if (justPaid) {
      await this.orderNotifications.paid(order)
    }

    return view
  }
}
