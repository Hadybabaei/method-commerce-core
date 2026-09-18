import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  BASKET_READ_MODEL,
  BasketReadModel,
} from '@modules/basket/application/ports/basket-read.port'
import {
  BASKET_REPOSITORY,
  BasketRepository,
} from '@modules/basket/domain/repositories/basket.repository'
import { OrderingJobsConfig } from '@config/ordering-jobs.config'
import { UseCase } from '@shared/application/use-case'
import { PrismaService } from '@shared/infrastructure/persistence/prisma/prisma.service'
import { isUniqueConstraintError } from '@shared/infrastructure/persistence/prisma/prisma-errors'
import { Order } from '../../domain/entities/order.aggregate'
import { PaymentMethod } from '../../domain/enums/order.enums'
import {
  BasketNotReadyError,
  EmptyBasketError,
  OrderNotFoundError,
} from '../../domain/errors/ordering.errors'
import { formatOrderDayKey } from '../../domain/order-number'
import {
  INVENTORY_RESERVATION,
  InventoryReservationService,
  ORDER_REPOSITORY,
  OrderRepository,
} from '../../domain/repositories/order.repository'
import { CreateOrderCommand, OrderView } from '../dto/views'
import {
  ORDER_PAYMENT_TIMEOUT_SCHEDULER,
  OrderPaymentTimeoutScheduler,
} from '../ports/order-payment-timeout.port'
import { ORDER_READ_MODEL, OrderReadModel } from '../ports/order-read.port'
import { OrderNotificationService } from '../order-notification.service'
import { CheckoutAssembler } from '../services/checkout-assembler.service'
import { CancelOrderUseCase } from './cancel-order.use-case'

const MAX_ORDER_NUMBER_RETRIES = 5

@Injectable()
export class CreateOrderUseCase implements UseCase<CreateOrderCommand, OrderView> {
  private readonly unpaidCancelDelayMs: number

  constructor(
    @Inject(BASKET_READ_MODEL) private readonly basketReads: BasketReadModel,
    @Inject(BASKET_REPOSITORY) private readonly baskets: BasketRepository,
    private readonly assembler: CheckoutAssembler,
    @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepository,
    @Inject(ORDER_READ_MODEL) private readonly orderReads: OrderReadModel,
    @Inject(INVENTORY_RESERVATION) private readonly inventory: InventoryReservationService,
    @Inject(ORDER_PAYMENT_TIMEOUT_SCHEDULER)
    private readonly paymentTimeouts: OrderPaymentTimeoutScheduler,
    private readonly cancelOrder: CancelOrderUseCase,
    private readonly orderNotifications: OrderNotificationService,
    private readonly prisma: PrismaService,
    configService: ConfigService
  ) {
    this.unpaidCancelDelayMs =
      configService.getOrThrow<OrderingJobsConfig>('orderingJobs').unpaidCancelDelayMs
  }

  async execute(command: CreateOrderCommand): Promise<OrderView> {
    const basketView = await this.basketReads.getByUserId(command.userId)
    if (!basketView || basketView.items.length === 0) {
      throw new EmptyBasketError()
    }

    const blocked = basketView.items.filter((line) => line.issues.length > 0)
    if (blocked.length > 0) {
      throw new BasketNotReadyError({
        lines: blocked.map((line) => ({
          variantId: line.variantId,
          issues: line.issues,
        })),
      })
    }

    const addressView = await this.assembler.requireOwnedAddress(command.userId, command.addressId)
    const dayKey = formatOrderDayKey(new Date())

    const created = await this.createWithNumberRetry(command, addressView, dayKey)

    const view = await this.orderReads.findById(created.id)
    if (!view) {
      throw new OrderNotFoundError(created.id)
    }

    if (created.paymentMethod === PaymentMethod.Online) {
      try {
        await this.paymentTimeouts.scheduleCancelIfUnpaid(created.id, this.unpaidCancelDelayMs)
      } catch (error) {
        await this.cancelOrder.execute({ orderId: created.id })
        throw error
      }
    }

    await this.orderNotifications.created(created)

    return view
  }

  private async createWithNumberRetry(
    command: CreateOrderCommand,
    addressView: Awaited<ReturnType<CheckoutAssembler['requireOwnedAddress']>>,
    dayKey: string
  ): Promise<Order> {
    let lastError: unknown = new Error('Could not allocate an order number')

    for (let attempt = 0; attempt < MAX_ORDER_NUMBER_RETRIES; attempt++) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const basket = await this.baskets.lockByUserId(command.userId, tx)
          if (!basket || basket.isEmpty) {
            throw new EmptyBasketError()
          }

          const orderItems = await this.assembler.buildItems(
            basket.getItems().map((item) => ({
              variantId: item.variantId,
              quantity: item.quantityValue,
            }))
          )

          const sequence = await this.orders.nextDailySequence(dayKey, tx)
          const number = `ORD-${dayKey}-${String(sequence).padStart(5, '0')}`

          const draft = Order.create({
            number,
            userId: command.userId,
            paymentMethod: command.paymentMethod ?? PaymentMethod.CashOnDelivery,
            items: orderItems,
            addressSnapshot: addressView,
            note: command.note,
          })

          const plan = await this.inventory.reserve(
            orderItems.map((item) => ({
              variantId: item.variantId as number,
              quantity: item.quantity,
            })),
            tx
          )
          draft.markReserved(plan)

          const saved = await this.orders.create(draft, tx)

          basket.clear()
          await this.baskets.save(basket, tx)

          return saved
        })
      } catch (error) {
        lastError = error
        if (!isUniqueConstraintError(error)) {
          throw error
        }
      }
    }

    throw lastError
  }
}
