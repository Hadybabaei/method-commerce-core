import { Inject, Injectable } from '@nestjs/common'
import { CLOCK, Clock } from '@shared/application/ports/clock.port'
import { UseCase } from '@shared/application/use-case'
import { PrismaService } from '@shared/infrastructure/persistence/prisma/prisma.service'
import { OrderStatus } from '../../domain/enums/order.enums'
import { OrderNotFoundError } from '../../domain/errors/ordering.errors'
import { ORDER_REPOSITORY, OrderRepository } from '../../domain/repositories/order.repository'
import { OrderView } from '../dto/views'
import { ORDER_READ_MODEL, OrderReadModel } from '../ports/order-read.port'
import { OrderNotificationService } from '../order-notification.service'

export interface ShipOrderCommand {
  orderId: number
  trackingCode?: string | null
  /** Overrides the URL built from the shipping method's template. */
  trackingUrl?: string | null
}

/**
 * Operator hands the parcel to the carrier. On an already shipped order this
 * only corrects the tracking details and does not notify the customer again.
 */
@Injectable()
export class ShipOrderUseCase implements UseCase<ShipOrderCommand, OrderView> {
  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepository,
    @Inject(ORDER_READ_MODEL) private readonly orderReads: OrderReadModel,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly orderNotifications: OrderNotificationService,
    private readonly prisma: PrismaService
  ) {}

  async execute(command: ShipOrderCommand): Promise<OrderView> {
    const { order, justShipped } = await this.prisma.$transaction(async (tx) => {
      const locked = await this.orders.findByIdForUpdate(command.orderId, tx)
      if (!locked) {
        throw new OrderNotFoundError(command.orderId)
      }

      const before = locked.status
      locked.ship(this.clock.now(), {
        trackingCode: command.trackingCode,
        trackingUrl: command.trackingUrl,
      })
      const saved = await this.orders.saveIfStatus(locked, before, tx)
      return { order: saved, justShipped: before !== OrderStatus.Shipped }
    })

    const view = await this.orderReads.findById(order.id)
    if (!view) {
      throw new OrderNotFoundError(order.id)
    }

    if (justShipped) {
      await this.orderNotifications.shipped(order)
    }

    return view
  }
}
