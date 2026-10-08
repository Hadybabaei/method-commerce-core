import { Inject, Injectable } from '@nestjs/common'
import {
  STORE_SETTINGS,
  StoreSettingsRepository,
} from '@modules/store/application/store-settings.port'
import { CLOCK, Clock } from '@shared/application/ports/clock.port'
import { UseCase } from '@shared/application/use-case'
import { PrismaService } from '@shared/infrastructure/persistence/prisma/prisma.service'
import { Order } from '../../domain/entities/order.aggregate'
import { Refund } from '../../domain/entities/refund.entity'
import { ReturnRequest } from '../../domain/entities/return-request.aggregate'
import { ReturnRequestStatus } from '../../domain/enums/order.enums'
import {
  OrderNotFoundError,
  RefundNotAllowedError,
  ReturnRequestNotFoundError,
} from '../../domain/errors/ordering.errors'
import {
  INVENTORY_RESERVATION,
  InventoryReservationService,
  ORDER_REPOSITORY,
  OrderRepository,
} from '../../domain/repositories/order.repository'
import { REFUND_REPOSITORY, RefundRepository } from '../../domain/repositories/refund.repository'
import {
  RETURN_REQUEST_REPOSITORY,
  ReturnRequestRepository,
} from '../../domain/repositories/return-request.repository'
import {
  OrderView,
  PaginatedReturnRequestsView,
  RecordRefundCommand,
  RequestReturnCommand,
} from '../dto/views'
import { OrderNotificationService } from '../order-notification.service'
import { ORDER_READ_MODEL, OrderReadModel } from '../ports/order-read.port'

/** Shared tail: reload the order view after a write. */
async function viewOf(orderReads: OrderReadModel, orderId: number): Promise<OrderView> {
  const view = await orderReads.findById(orderId)
  if (!view) {
    throw new OrderNotFoundError(orderId)
  }
  return view
}

async function lockOrder(orders: OrderRepository, orderId: number, tx: unknown): Promise<Order> {
  const order = await orders.findByIdForUpdate(orderId, tx)
  if (!order) {
    throw new OrderNotFoundError(orderId)
  }
  return order
}

/** Customer asks to send back lines of a delivered order. */
@Injectable()
export class RequestReturnUseCase implements UseCase<RequestReturnCommand, OrderView> {
  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepository,
    @Inject(ORDER_READ_MODEL) private readonly orderReads: OrderReadModel,
    @Inject(RETURN_REQUEST_REPOSITORY) private readonly returns: ReturnRequestRepository,
    @Inject(STORE_SETTINGS) private readonly settings: StoreSettingsRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly orderNotifications: OrderNotificationService,
    private readonly prisma: PrismaService
  ) {}

  async execute(command: RequestReturnCommand): Promise<OrderView> {
    const { returnWindowDays } = await this.settings.get()

    const order = await this.prisma.$transaction(async (tx) => {
      // The order lock serialises concurrent requests so quantities cannot be double-claimed.
      const locked = await lockOrder(this.orders, command.orderId, tx)
      const existing = await this.returns.listByOrder(locked.id, tx)

      const alreadyRequested = new Map<number, number>()
      for (const request of existing) {
        if (request.status === ReturnRequestStatus.Rejected) continue
        for (const line of request.items) {
          alreadyRequested.set(
            line.orderItemId,
            (alreadyRequested.get(line.orderItemId) ?? 0) + line.quantity
          )
        }
      }

      const request = ReturnRequest.request({
        order: locked,
        userId: command.userId,
        items: command.items,
        reason: command.reason,
        now: this.clock.now(),
        windowDays: returnWindowDays,
        alreadyRequested,
      })
      await this.returns.save(request, tx)
      return locked
    })

    await this.orderNotifications.returnRequested(order)
    return viewOf(this.orderReads, order.id)
  }
}

@Injectable()
export class ListReturnRequestsUseCase implements UseCase<
  { status?: ReturnRequestStatus; limit?: number; offset?: number },
  PaginatedReturnRequestsView
> {
  constructor(@Inject(ORDER_READ_MODEL) private readonly orderReads: OrderReadModel) {}

  execute(query: { status?: ReturnRequestStatus; limit?: number; offset?: number }) {
    return this.orderReads.listReturnRequests({
      status: query.status,
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
    })
  }
}

export interface DecideReturnCommand {
  returnRequestId: number
  decision: 'approve' | 'reject'
  note?: string | null
}

/** Admin approves (items may come back) or rejects (with a reason) a request. */
@Injectable()
export class DecideReturnUseCase implements UseCase<DecideReturnCommand, OrderView> {
  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepository,
    @Inject(ORDER_READ_MODEL) private readonly orderReads: OrderReadModel,
    @Inject(RETURN_REQUEST_REPOSITORY) private readonly returns: ReturnRequestRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly orderNotifications: OrderNotificationService,
    private readonly prisma: PrismaService
  ) {}

  async execute(command: DecideReturnCommand): Promise<OrderView> {
    const found = await this.returns.findById(command.returnRequestId)
    if (!found) {
      throw new ReturnRequestNotFoundError(command.returnRequestId)
    }

    const { order, request } = await this.prisma.$transaction(async (tx) => {
      const locked = await lockOrder(this.orders, found.orderId, tx)
      const current = await this.returns.findById(command.returnRequestId, tx)
      if (!current) {
        throw new ReturnRequestNotFoundError(command.returnRequestId)
      }

      if (command.decision === 'approve') {
        current.approve(this.clock.now(), command.note)
      } else {
        current.reject(this.clock.now(), command.note ?? '')
      }
      return { order: locked, request: await this.returns.save(current, tx) }
    })

    if (request.status === ReturnRequestStatus.Approved) {
      await this.orderNotifications.returnApproved(order)
    } else {
      await this.orderNotifications.returnRejected(order, request.adminNote)
    }
    return viewOf(this.orderReads, order.id)
  }
}

/**
 * Admin records money already paid back by bank transfer. Optionally settles
 * an approved return and puts its units back on hand.
 */
@Injectable()
export class RecordRefundUseCase implements UseCase<RecordRefundCommand, OrderView> {
  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepository,
    @Inject(ORDER_READ_MODEL) private readonly orderReads: OrderReadModel,
    @Inject(RETURN_REQUEST_REPOSITORY) private readonly returns: ReturnRequestRepository,
    @Inject(REFUND_REPOSITORY) private readonly refunds: RefundRepository,
    @Inject(INVENTORY_RESERVATION) private readonly inventory: InventoryReservationService,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly orderNotifications: OrderNotificationService,
    private readonly prisma: PrismaService
  ) {}

  async execute(command: RecordRefundCommand): Promise<OrderView> {
    const { order, refund } = await this.prisma.$transaction(async (tx) => {
      const locked = await lockOrder(this.orders, command.orderId, tx)

      let returnRequest: ReturnRequest | null = null
      if (command.returnRequestId) {
        returnRequest = await this.returns.findById(command.returnRequestId, tx)
        if (!returnRequest) {
          throw new ReturnRequestNotFoundError(command.returnRequestId)
        }
      }

      const now = this.clock.now()
      const refund = Refund.record({
        order: locked,
        amount: command.amount,
        reference: command.reference,
        paidAt: command.paidAt ?? now,
        note: command.note,
        adminId: command.adminId,
        returnRequest,
        restock: command.restock,
        now,
      })

      if (refund.restocked && returnRequest) {
        const lines = returnRequest.items.flatMap((line) => {
          const item = locked.items.find((orderItem) => orderItem.id === line.orderItemId)
          return item?.variantId ? [{ variantId: item.variantId, quantity: line.quantity }] : []
        })
        if (lines.length === 0) {
          throw new RefundNotAllowedError('None of the returned products exist any more to restock')
        }
        await this.inventory.restock(lines, locked.stockAllocations, tx)
      }

      const saved = await this.orders.save(locked, tx)
      if (returnRequest) {
        await this.returns.save(returnRequest, tx)
      }
      return { order: saved, refund: await this.refunds.create(refund, tx) }
    })

    await this.orderNotifications.refundPaid(order, refund.amount.amount, refund.reference)
    return viewOf(this.orderReads, order.id)
  }
}
