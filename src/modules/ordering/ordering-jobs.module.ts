import { BullModule } from '@nestjs/bullmq'
import { Global, Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { RedisConfig } from '@config/redis.config'
import {
  BULLMQ_ORDER_PAYMENT_TIMEOUT_SCHEDULER,
  UNPAID_ORDER_QUEUE,
} from './application/ports/order-payment-timeout.port'
import { PAYMENT_INQUIRY_QUEUE } from './application/ports/payment-inquiry.port'
import { BULLMQ_ORDER_SMS_DISPATCHER, ORDER_SMS_QUEUE } from './application/ports/order-sms.port'
import { BullmqOrderSmsDispatcher } from './infrastructure/sms/bullmq-order-sms.dispatcher'
import { SendOrderSmsProcessor } from './infrastructure/sms/send-order-sms.processor'
import { BullmqOrderPaymentTimeoutScheduler } from './infrastructure/jobs/bullmq-order-payment-timeout.scheduler'
import { CancelUnpaidOrderProcessor } from './infrastructure/jobs/cancel-unpaid-order.processor'
import { InquireOpenPaymentsProcessor } from './infrastructure/jobs/inquire-open-payments.processor'
import { PaymentInquiryScheduler } from './infrastructure/jobs/payment-inquiry.scheduler'
import { OrderingModule } from './ordering.module'

/**
 * BullMQ workers for unpaid-order cancel, payment inquiry and order SMS.
 * Loaded from AppModule only when Redis is enabled — keep this file free of
 * static imports from AppModule's always-on path so Jest does not load ESM BullMQ.
 */
@Global()
@Module({
  imports: [
    OrderingModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redis = configService.getOrThrow<RedisConfig>('redis')
        return { connection: { url: redis.url, maxRetriesPerRequest: null } }
      },
    }),
    BullModule.registerQueue({ name: UNPAID_ORDER_QUEUE }),
    BullModule.registerQueue({ name: PAYMENT_INQUIRY_QUEUE }),
    BullModule.registerQueue({ name: ORDER_SMS_QUEUE }),
  ],
  providers: [
    BullmqOrderPaymentTimeoutScheduler,
    {
      provide: BULLMQ_ORDER_PAYMENT_TIMEOUT_SCHEDULER,
      useExisting: BullmqOrderPaymentTimeoutScheduler,
    },
    CancelUnpaidOrderProcessor,
    InquireOpenPaymentsProcessor,
    PaymentInquiryScheduler,
    BullmqOrderSmsDispatcher,
    { provide: BULLMQ_ORDER_SMS_DISPATCHER, useExisting: BullmqOrderSmsDispatcher },
    SendOrderSmsProcessor,
  ],
  exports: [BULLMQ_ORDER_PAYMENT_TIMEOUT_SCHEDULER, BULLMQ_ORDER_SMS_DISPATCHER],
})
export class OrderingJobsModule {}
