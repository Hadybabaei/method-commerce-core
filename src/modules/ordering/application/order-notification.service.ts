import { Inject, Injectable, Logger } from '@nestjs/common'
import {
  NOTIFICATIONS,
  NotificationContext,
  NotificationTypes,
  Notifications,
} from '@modules/notifications'
import { Order } from '../domain/entities/order.aggregate'

type OrderNotice = Pick<Order, 'id' | 'number' | 'userId' | 'status' | 'paymentMethod'> & {
  subtotal: { amount: number }
}

/**
 * Fan-out for order lifecycle events. Customer and admin copies differ;
 * `allAdmins` is expanded inside the notifications module.
 */
@Injectable()
export class OrderNotificationService {
  private readonly logger = new Logger(OrderNotificationService.name)

  constructor(@Inject(NOTIFICATIONS) private readonly notifications: Notifications) {}

  created(order: OrderNotice): Promise<void> {
    return this.send(order, NotificationTypes.ordering.orderCreated, {
      userTitle: `Order ${order.number} placed`,
      userBody: `We received your order ${order.number} and reserved the items.`,
      adminTitle: `New order ${order.number}`,
      adminBody: `Customer ${order.userId} placed ${order.number}.`,
    })
  }

  cancelled(order: OrderNotice): Promise<void> {
    return this.send(order, NotificationTypes.ordering.orderCancelled, {
      userTitle: `Order ${order.number} cancelled`,
      userBody: `Your order ${order.number} was cancelled. Reserved stock is released.`,
      adminTitle: `Order ${order.number} cancelled`,
      adminBody: `Order ${order.number} for customer ${order.userId} was cancelled.`,
    })
  }

  paid(order: OrderNotice): Promise<void> {
    return this.send(order, NotificationTypes.ordering.orderPaid, {
      userTitle: `Order ${order.number} paid`,
      userBody: `Payment for ${order.number} was confirmed.`,
      adminTitle: `Order ${order.number} paid`,
      adminBody: `Order ${order.number} for customer ${order.userId} is paid.`,
    })
  }

  completed(order: OrderNotice): Promise<void> {
    return this.send(order, NotificationTypes.ordering.orderCompleted, {
      userTitle: `Order ${order.number} delivered`,
      userBody: `Your order ${order.number} is complete.`,
      adminTitle: `Order ${order.number} completed`,
      adminBody: `Order ${order.number} for customer ${order.userId} was marked delivered.`,
    })
  }

  private async send(
    order: OrderNotice,
    type: string,
    copy: { userTitle: string; userBody: string; adminTitle: string; adminBody: string }
  ): Promise<void> {
    try {
      await this.notifications.sendNotification({
        context: NotificationContext.Ordering,
        type,
        title: copy.userTitle,
        body: copy.userBody,
        data: {
          orderId: order.id,
          number: order.number,
          userId: order.userId,
          status: order.status,
          paymentMethod: order.paymentMethod,
          subtotal: order.subtotal.amount,
        },
        recipients: [
          {
            audience: 'user',
            userId: order.userId,
            title: copy.userTitle,
            body: copy.userBody,
          },
          {
            audience: 'admin',
            allAdmins: true,
            title: copy.adminTitle,
            body: copy.adminBody,
          },
        ],
      })
    } catch (error) {
      this.logger.error(
        `Order notification ${type} failed for ${order.number}`,
        error instanceof Error ? error.stack : undefined
      )
    }
  }
}
