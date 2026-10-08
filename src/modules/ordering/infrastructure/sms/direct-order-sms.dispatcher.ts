import { Inject, Injectable, Logger } from '@nestjs/common'
import { SMS_SENDER, SmsSender } from '@shared/application/ports/sms-sender.port'
import { OrderSms, OrderSmsDispatcher } from '../../application/ports/order-sms.port'

/** Sends inline with no retry. Used when Redis/BullMQ is off. */
@Injectable()
export class DirectOrderSmsDispatcher implements OrderSmsDispatcher {
  private readonly logger = new Logger(DirectOrderSmsDispatcher.name)

  constructor(@Inject(SMS_SENDER) private readonly sms: SmsSender) {}

  async dispatch(message: OrderSms): Promise<void> {
    try {
      await this.sms.send(message.phoneNumber, message.text)
    } catch (error) {
      this.logger.error(
        `Order SMS failed for order ${message.orderId}`,
        error instanceof Error ? error.stack : undefined
      )
    }
  }
}
