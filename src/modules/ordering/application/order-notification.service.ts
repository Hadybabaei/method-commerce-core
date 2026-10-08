import { Inject, Injectable, Logger } from '@nestjs/common'
import {
  NOTIFICATIONS,
  NotificationContext,
  NotificationTypes,
  Notifications,
} from '@modules/notifications'
import {
  USER_REPOSITORY,
  UserRepository,
} from '@modules/identity/domain/repositories/user.repository'
import { Order } from '../domain/entities/order.aggregate'
import { PaymentMethod } from '../domain/enums/order.enums'
import { orderSmsMessages } from './order-sms-messages'
import { ORDER_SMS_DISPATCHER, OrderSmsDispatcher } from './ports/order-sms.port'

type OrderNotice = Pick<
  Order,
  'id' | 'number' | 'userId' | 'status' | 'paymentMethod' | 'trackingCode' | 'trackingUrl'
> & {
  subtotal: { amount: number }
  total: { amount: number }
}

/**
 * Fan-out for order lifecycle events: in-app notices for the customer and all
 * admins, plus an SMS to the customer. Failures are logged and never thrown.
 */
@Injectable()
export class OrderNotificationService {
  private readonly logger = new Logger(OrderNotificationService.name)

  constructor(
    @Inject(NOTIFICATIONS) private readonly notifications: Notifications,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(ORDER_SMS_DISPATCHER) private readonly sms: OrderSmsDispatcher
  ) {}

  async created(order: OrderNotice): Promise<void> {
    await this.send(order, NotificationTypes.ordering.orderCreated, {
      userTitle: `Order ${order.number} placed`,
      userBody: `We received your order ${order.number} and reserved the items.`,
      adminTitle: `New order ${order.number}`,
      adminBody: `Customer ${order.userId} placed ${order.number}.`,
    })
    // Online orders hear from us once the payment clears instead.
    if (order.paymentMethod === PaymentMethod.CashOnDelivery) {
      await this.text(order, orderSmsMessages.created(order))
    }
  }

  async cancelled(order: OrderNotice): Promise<void> {
    await this.send(order, NotificationTypes.ordering.orderCancelled, {
      userTitle: `Order ${order.number} cancelled`,
      userBody: `Your order ${order.number} was cancelled. Reserved stock is released.`,
      adminTitle: `Order ${order.number} cancelled`,
      adminBody: `Order ${order.number} for customer ${order.userId} was cancelled.`,
    })
    await this.text(order, orderSmsMessages.cancelled(order))
  }

  async paid(order: OrderNotice): Promise<void> {
    await this.send(order, NotificationTypes.ordering.orderPaid, {
      userTitle: `Order ${order.number} paid`,
      userBody: `Payment for ${order.number} was confirmed.`,
      adminTitle: `Order ${order.number} paid`,
      adminBody: `Order ${order.number} for customer ${order.userId} is paid.`,
    })
    await this.text(order, orderSmsMessages.paid(order))
  }

  async processing(order: OrderNotice): Promise<void> {
    await this.send(order, NotificationTypes.ordering.orderProcessing, {
      userTitle: `Order ${order.number} is being prepared`,
      userBody: `We are packing your order ${order.number}.`,
      adminTitle: `Order ${order.number} processing`,
      adminBody: `Order ${order.number} for customer ${order.userId} moved to processing.`,
    })
    await this.text(order, orderSmsMessages.processing(order))
  }

  async shipped(order: OrderNotice): Promise<void> {
    const tracking = order.trackingCode ? ` Tracking code: ${order.trackingCode}.` : ''
    await this.send(order, NotificationTypes.ordering.orderShipped, {
      userTitle: `Order ${order.number} shipped`,
      userBody: `Your order ${order.number} is on its way.${tracking}`,
      adminTitle: `Order ${order.number} shipped`,
      adminBody: `Order ${order.number} for customer ${order.userId} was shipped.${tracking}`,
    })
    await this.text(order, orderSmsMessages.shipped(order))
  }

  async completed(order: OrderNotice): Promise<void> {
    await this.send(order, NotificationTypes.ordering.orderCompleted, {
      userTitle: `Order ${order.number} delivered`,
      userBody: `Your order ${order.number} is complete.`,
      adminTitle: `Order ${order.number} completed`,
      adminBody: `Order ${order.number} for customer ${order.userId} was marked delivered.`,
    })
    await this.text(order, orderSmsMessages.completed(order))
  }

  async returnRequested(order: OrderNotice): Promise<void> {
    await this.send(order, NotificationTypes.ordering.returnRequested, {
      userTitle: `Return requested for ${order.number}`,
      userBody: `We received your return request for ${order.number} and will review it soon.`,
      adminTitle: `Return requested for ${order.number}`,
      adminBody: `Customer ${order.userId} asked to return items from ${order.number}.`,
    })
  }

  async returnApproved(order: OrderNotice): Promise<void> {
    await this.send(order, NotificationTypes.ordering.returnApproved, {
      userTitle: `Return approved for ${order.number}`,
      userBody: `Your return for ${order.number} was approved. Please send the items back.`,
      adminTitle: `Return approved for ${order.number}`,
      adminBody: `The return for ${order.number} was approved and awaits a refund.`,
    })
    await this.text(order, orderSmsMessages.returnApproved(order))
  }

  async returnRejected(order: OrderNotice, note: string | null): Promise<void> {
    const reason = note ? ` Reason: ${note}` : ''
    await this.send(order, NotificationTypes.ordering.returnRejected, {
      userTitle: `Return rejected for ${order.number}`,
      userBody: `Your return for ${order.number} was rejected.${reason}`,
      adminTitle: `Return rejected for ${order.number}`,
      adminBody: `The return for ${order.number} was rejected.${reason}`,
    })
    await this.text(order, orderSmsMessages.returnRejected(order, note))
  }

  async refundPaid(order: OrderNotice, amount: number, reference: string): Promise<void> {
    await this.send(order, NotificationTypes.ordering.refundPaid, {
      userTitle: `Refund for ${order.number}`,
      userBody: `We paid back ${amount} Rial for ${order.number}. Transfer reference: ${reference}.`,
      adminTitle: `Refund recorded for ${order.number}`,
      adminBody: `${amount} Rial refunded for ${order.number} (reference ${reference}).`,
    })
    await this.text(order, orderSmsMessages.refundPaid(order, amount, reference))
  }

  private async text(order: OrderNotice, text: string): Promise<void> {
    try {
      const user = await this.users.findById(order.userId)
      if (!user) {
        this.logger.warn(`Order SMS skipped for ${order.number}: user ${order.userId} not found`)
        return
      }
      await this.sms.dispatch({ orderId: order.id, phoneNumber: user.phoneNumber.value, text })
    } catch (error) {
      this.logger.error(
        `Order SMS failed for ${order.number}`,
        error instanceof Error ? error.stack : undefined
      )
    }
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
          total: order.total.amount,
          trackingCode: order.trackingCode,
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
