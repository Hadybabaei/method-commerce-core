import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  ADDRESS_READ_MODEL,
  AddressReadModel,
} from '@modules/addressing/application/ports/address-read.port'
import { AddressNotFoundError } from '@modules/addressing/domain/errors/addressing.errors'
import {
  ADDRESS_REPOSITORY,
  AddressRepository,
} from '@modules/addressing/domain/repositories/address.repository'
import {
  BASKET_READ_MODEL,
  BasketReadModel,
} from '@modules/basket/application/ports/basket-read.port'
import {
  BASKET_REPOSITORY,
  BasketRepository,
} from '@modules/basket/domain/repositories/basket.repository'
import {
  SELLABLE_VARIANT_LOOKUP,
  SellableVariantLookup,
} from '@modules/catalog/application/ports/sellable-variant.port'
import { OrderingJobsConfig } from '@config/ordering-jobs.config'
import { UseCase } from '@shared/application/use-case'
import { Money } from '@shared/domain/value-objects/money'
import { PrismaService } from '@shared/infrastructure/persistence/prisma/prisma.service'
import { Order } from '../../domain/entities/order.aggregate'
import { OrderItem } from '../../domain/entities/order-item.entity'
import { PaymentMethod } from '../../domain/enums/order.enums'
import {
  BasketNotReadyError,
  EmptyBasketError,
  InsufficientStockForOrderError,
  OrderNotFoundError,
} from '../../domain/errors/ordering.errors'
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

@Injectable()
export class CreateOrderUseCase implements UseCase<CreateOrderCommand, OrderView> {
  private readonly unpaidCancelDelayMs: number

  constructor(
    @Inject(BASKET_READ_MODEL) private readonly basketReads: BasketReadModel,
    @Inject(BASKET_REPOSITORY) private readonly baskets: BasketRepository,
    @Inject(ADDRESS_REPOSITORY) private readonly addresses: AddressRepository,
    @Inject(ADDRESS_READ_MODEL) private readonly addressReads: AddressReadModel,
    @Inject(SELLABLE_VARIANT_LOOKUP) private readonly variants: SellableVariantLookup,
    @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepository,
    @Inject(ORDER_READ_MODEL) private readonly orderReads: OrderReadModel,
    @Inject(INVENTORY_RESERVATION) private readonly inventory: InventoryReservationService,
    @Inject(ORDER_PAYMENT_TIMEOUT_SCHEDULER)
    private readonly paymentTimeouts: OrderPaymentTimeoutScheduler,
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

    const address = await this.addresses.findById(command.addressId)
    if (!address) {
      throw new AddressNotFoundError(command.addressId)
    }
    address.ensureOwnedBy(command.userId)

    const addressView = await this.addressReads.findById(command.addressId)
    if (!addressView) {
      throw new AddressNotFoundError(command.addressId)
    }

    const orderItems: OrderItem[] = []
    for (const line of basketView.items) {
      const sellable = await this.variants.findById(line.variantId)
      if (!sellable || !sellable.productPublished || !sellable.isActive) {
        throw new BasketNotReadyError({ variantId: line.variantId, reason: 'not_sellable' })
      }
      if (line.quantity > sellable.availableQuantity) {
        throw new InsufficientStockForOrderError(
          line.variantId,
          sellable.availableQuantity,
          line.quantity
        )
      }

      orderItems.push(
        OrderItem.create({
          variantId: line.variantId,
          quantity: line.quantity,
          unitPrice: Money.fromMinor(sellable.unitPrice),
          snapshot: {
            productId: sellable.productId,
            variantId: sellable.variantId,
            title: sellable.productTitle,
            slug: sellable.productSlug,
            sku: sellable.sku,
            options: sellable.options,
            image: sellable.image,
            thumbnail: sellable.thumbnail,
          },
        })
      )
    }

    const dayKey = formatDayKey(new Date())

    const created = await this.prisma.$transaction(async (tx) => {
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

      const basket = await this.baskets.findByUserId(command.userId)
      if (basket) {
        basket.clear()
        await this.baskets.save(basket, tx)
      }

      return saved
    })

    const view = await this.orderReads.findById(created.id)
    if (!view) {
      throw new OrderNotFoundError(created.id)
    }

    if (created.paymentMethod === PaymentMethod.Online) {
      await this.paymentTimeouts.scheduleCancelIfUnpaid(created.id, this.unpaidCancelDelayMs)
    }

    await this.orderNotifications.created(created)

    return view
  }
}

function formatDayKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}${month}${day}`
}
