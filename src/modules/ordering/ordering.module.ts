import { Module } from '@nestjs/common'
import { AddressingModule } from '@modules/addressing/addressing.module'
import { BasketModule } from '@modules/basket/basket.module'
import { CatalogModule } from '@modules/catalog/catalog.module'
import { IdentityModule } from '@modules/identity/identity.module'
import { NotificationsModule } from '@modules/notifications/notifications.module'
import { ORDER_PAYMENT_TIMEOUT_SCHEDULER } from './application/ports/order-payment-timeout.port'
import { ORDER_READ_MODEL } from './application/ports/order-read.port'
import { PAYMENT_GATEWAY } from './application/ports/payment-gateway.port'
import { CancelOrderUseCase } from './application/use-cases/cancel-order.use-case'
import { CompleteOrderUseCase } from './application/use-cases/complete-order.use-case'
import { ConfirmCodPaymentUseCase } from './application/use-cases/confirm-cod-payment.use-case'
import { CreateOrderUseCase } from './application/use-cases/create-order.use-case'
import {
  GetOrderUseCase,
  ListOrdersUseCase,
} from './application/use-cases/get-list-orders.use-case'
import { HandlePaymentCallbackUseCase } from './application/use-cases/handle-payment-callback.use-case'
import { InitiatePaymentUseCase } from './application/use-cases/initiate-payment.use-case'
import { PreviewCheckoutUseCase } from './application/use-cases/preview-checkout.use-case'
import { CheckoutAssembler } from './application/services/checkout-assembler.service'
import { INVENTORY_RESERVATION, ORDER_REPOSITORY } from './domain/repositories/order.repository'
import { PAYMENT_REPOSITORY } from './domain/repositories/payment.repository'
import { NoopOrderPaymentTimeoutScheduler } from './infrastructure/jobs/noop-order-payment-timeout.scheduler'
import { ZibalPaymentGateway } from './infrastructure/payment/zibal-payment.gateway'
import { PrismaInventoryReservationService } from './infrastructure/persistence/prisma-inventory-reservation.service'
import { PrismaOrderReadModel } from './infrastructure/persistence/prisma-order-read.model'
import { PrismaOrderRepository } from './infrastructure/persistence/prisma-order.repository'
import { PrismaPaymentRepository } from './infrastructure/persistence/prisma-payment.repository'
import { AdminOrdersController } from './presentation/controllers/admin-orders.controller'
import { OrdersController } from './presentation/controllers/orders.controller'
import { PaymentsController } from './presentation/controllers/payments.controller'
import { OrderNotificationService } from './application/order-notification.service'

const useCases = [
  CreateOrderUseCase,
  PreviewCheckoutUseCase,
  CancelOrderUseCase,
  ConfirmCodPaymentUseCase,
  CompleteOrderUseCase,
  GetOrderUseCase,
  ListOrdersUseCase,
  InitiatePaymentUseCase,
  HandlePaymentCallbackUseCase,
]

/**
 * Ordering bounded context. Unpaid-order BullMQ workers live in
 * `OrderingJobsModule` (loaded when Redis is enabled).
 */
@Module({
  imports: [IdentityModule, BasketModule, CatalogModule, AddressingModule, NotificationsModule],
  controllers: [OrdersController, AdminOrdersController, PaymentsController],
  providers: [
    { provide: ORDER_REPOSITORY, useClass: PrismaOrderRepository },
    { provide: ORDER_READ_MODEL, useClass: PrismaOrderReadModel },
    { provide: PAYMENT_REPOSITORY, useClass: PrismaPaymentRepository },
    { provide: INVENTORY_RESERVATION, useClass: PrismaInventoryReservationService },
    { provide: PAYMENT_GATEWAY, useClass: ZibalPaymentGateway },
    { provide: ORDER_PAYMENT_TIMEOUT_SCHEDULER, useClass: NoopOrderPaymentTimeoutScheduler },
    OrderNotificationService,
    CheckoutAssembler,
    ...useCases,
  ],
  exports: [
    ORDER_REPOSITORY,
    ORDER_READ_MODEL,
    PAYMENT_REPOSITORY,
    PAYMENT_GATEWAY,
    ORDER_PAYMENT_TIMEOUT_SCHEDULER,
    CancelOrderUseCase,
  ],
})
export class OrderingModule {}
