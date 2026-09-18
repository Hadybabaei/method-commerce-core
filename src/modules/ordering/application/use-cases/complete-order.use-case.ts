import { Inject, Injectable } from '@nestjs/common'
import { CLOCK, Clock } from '@shared/application/ports/clock.port'
import { UseCase } from '@shared/application/use-case'
import { OrderNotFoundError } from '../../domain/errors/ordering.errors'
import { ORDER_REPOSITORY, OrderRepository } from '../../domain/repositories/order.repository'
import { OrderView } from '../dto/views'
import { ORDER_READ_MODEL, OrderReadModel } from '../ports/order-read.port'
import { OrderNotificationService } from '../order-notification.service'
import { OrderStatus } from '../../domain/enums/order.enums'

@Injectable()
export class CompleteOrderUseCase implements UseCase<{ orderId: number }, OrderView> {
  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepository,
    @Inject(ORDER_READ_MODEL) private readonly orderReads: OrderReadModel,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly orderNotifications: OrderNotificationService
  ) {}

  async execute(command: { orderId: number }): Promise<OrderView> {
    const order = await this.orders.findById(command.orderId)
    if (!order) {
      throw new OrderNotFoundError(command.orderId)
    }

    const alreadyComplete = order.status === OrderStatus.Completed
    order.complete(this.clock.now())
    await this.orders.save(order)

    const view = await this.orderReads.findById(order.id)
    if (!view) {
      throw new OrderNotFoundError(order.id)
    }

    if (!alreadyComplete) {
      await this.orderNotifications.completed(order)
    }

    return view
  }
}
