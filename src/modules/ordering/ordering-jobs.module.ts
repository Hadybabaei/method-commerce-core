import { BullModule } from '@nestjs/bullmq'
import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { RedisConfig } from '@config/redis.config'
import {
  ORDER_PAYMENT_TIMEOUT_SCHEDULER,
  UNPAID_ORDER_QUEUE,
} from './application/ports/order-payment-timeout.port'
import { BullmqOrderPaymentTimeoutScheduler } from './infrastructure/jobs/bullmq-order-payment-timeout.scheduler'
import { CancelUnpaidOrderProcessor } from './infrastructure/jobs/cancel-unpaid-order.processor'
import { OrderingModule } from './ordering.module'

/**
 * BullMQ workers for auto-cancelling ONLINE orders that stay unpaid.
 * Loaded from AppModule only when Redis is enabled — keep this file free of
 * static imports from AppModule's always-on path so Jest does not load ESM BullMQ.
 */
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
  ],
  providers: [
    { provide: ORDER_PAYMENT_TIMEOUT_SCHEDULER, useClass: BullmqOrderPaymentTimeoutScheduler },
    CancelUnpaidOrderProcessor,
  ],
  exports: [ORDER_PAYMENT_TIMEOUT_SCHEDULER],
})
export class OrderingJobsModule {}
