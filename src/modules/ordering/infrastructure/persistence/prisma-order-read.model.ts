import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '@shared/infrastructure/persistence/prisma/prisma.service'
import { AddressSnapshot } from '../../domain/entities/order.aggregate'
import { OrderProductSnapshot } from '../../domain/entities/order-item.entity'
import { REFUND_REQUIRED_PREFIX } from '../../domain/entities/payment.entity'
import { ShippingSnapshot } from '../../domain/entities/shipping-method.entity'
import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  ReturnRequestStatus,
} from '../../domain/enums/order.enums'
import { ReturnRequest } from '../../domain/entities/return-request.aggregate'
import {
  ListOrdersQuery,
  OrderItemView,
  OrderPaymentView,
  OrderView,
  PaginatedOrdersView,
  PaginatedReturnRequestsView,
  ReturnRequestView,
} from '../../application/dto/views'
import { OrderReadModel } from '../../application/ports/order-read.port'

@Injectable()
export class PrismaOrderReadModel implements OrderReadModel {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: number): Promise<OrderView | null> {
    const [record, windowDays] = await Promise.all([
      this.prisma.order.findUnique({ where: { id }, include: orderInclude }),
      this.returnWindowDays(),
    ])

    return record ? toView(record, windowDays) : null
  }

  async list(
    query: Required<Pick<ListOrdersQuery, 'limit' | 'offset'>> & ListOrdersQuery
  ): Promise<PaginatedOrdersView> {
    const where = toWhere(query)

    const windowDays = await this.returnWindowDays()
    const [total, records] = await this.prisma.$transaction([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        include: orderInclude,
        orderBy: { created_at: 'desc' },
        take: query.limit,
        skip: query.offset,
      }),
    ])

    return {
      items: records.map((record) => toView(record, windowDays)),
      total,
      limit: query.limit,
      offset: query.offset,
    }
  }

  async listReturnRequests(query: {
    status?: ReturnRequestStatus
    limit: number
    offset: number
  }): Promise<PaginatedReturnRequestsView> {
    const where: Prisma.return_requestWhereInput = query.status ? { status: query.status } : {}
    const [total, records] = await this.prisma.$transaction([
      this.prisma.return_request.count({ where }),
      this.prisma.return_request.findMany({
        where,
        include: { ...returnInclude, order: { select: { number: true } } },
        orderBy: [{ created_at: 'asc' }, { id: 'asc' }],
        take: query.limit,
        skip: query.offset,
      }),
    ])

    return {
      items: records.map((record) => ({
        ...toReturnView(record),
        orderId: record.orderId,
        orderNumber: record.order.number,
        userId: record.userId,
      })),
      total,
      limit: query.limit,
      offset: query.offset,
    }
  }

  private async returnWindowDays(): Promise<number> {
    const settings = await this.prisma.store_setting.findUnique({
      where: { id: 1 },
      select: { return_window_days: true },
    })
    return settings?.return_window_days ?? 7
  }
}

const returnInclude = {
  items: {
    orderBy: { id: 'asc' },
    include: { orderItem: { select: { productSnapshot: true } } },
  },
} satisfies Prisma.return_requestInclude

type ReturnRecord = Prisma.return_requestGetPayload<{ include: typeof returnInclude }>

function toReturnView(record: ReturnRecord): ReturnRequestView {
  return {
    id: record.id,
    status: record.status as ReturnRequestStatus,
    reason: record.reason,
    adminNote: record.adminNote,
    items: record.items.map((item) => {
      const product = item.orderItem.productSnapshot as unknown as OrderProductSnapshot
      return {
        orderItemId: item.orderItemId,
        quantity: item.quantity,
        title: product.title,
        sku: product.sku,
      }
    }),
    createdAt: record.created_at,
    decidedAt: record.decidedAt,
  }
}

const orderInclude = {
  items: { orderBy: { id: 'asc' } },
  payments: { orderBy: { id: 'desc' } },
  statusHistory: { orderBy: [{ created_at: 'asc' }, { id: 'asc' }] },
  returnRequests: { orderBy: { id: 'asc' }, include: returnInclude },
  refunds: { orderBy: { id: 'asc' } },
} satisfies Prisma.orderInclude

type OrderRecord = Prisma.orderGetPayload<{ include: typeof orderInclude }>

function toWhere(query: ListOrdersQuery): Prisma.orderWhereInput {
  const where: Prisma.orderWhereInput = {}

  if (query.userId !== undefined) {
    where.userId = query.userId
  }

  if (query.status) {
    where.status = query.status
  }

  if (query.search) {
    where.number = { contains: query.search.trim() }
  }

  if (query.createdFrom || query.createdTo) {
    where.created_at = {}
    if (query.createdFrom) {
      where.created_at.gte = query.createdFrom
    }
    if (query.createdTo) {
      where.created_at.lte = query.createdTo
    }
  }

  return where
}

function toView(record: OrderRecord, returnWindowDays: number): OrderView {
  const items: OrderItemView[] = record.items.map((item) => ({
    id: item.id,
    variantId: item.variantId,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    lineTotal: item.lineTotal,
    taxAmount: item.taxAmount,
    product: item.productSnapshot as unknown as OrderProductSnapshot,
  }))

  const payment = toPaymentView(record.payments[0] ?? null)
  const captured = payment?.status === PaymentStatus.Succeeded
  const shippingMethod = record.shippingSnapshot as unknown as ShippingSnapshot | null

  return {
    id: record.id,
    number: record.number,
    userId: record.userId,
    status: record.status as OrderStatus,
    paymentMethod: record.paymentMethod as PaymentMethod,
    itemCount: record.itemCount,
    subtotal: record.subtotal,
    shippingFee: record.shippingFee,
    taxRateBp: record.taxRateBp,
    taxTotal: record.taxTotal,
    total: record.total,
    refundedTotal: record.refundedTotal,
    shipping: {
      method: shippingMethod
        ? {
            id: shippingMethod.methodId,
            name: shippingMethod.name,
            code: shippingMethod.code,
            minDays: shippingMethod.minDays,
            maxDays: shippingMethod.maxDays,
          }
        : null,
      fee: record.shippingFee,
      weightGrams: record.weightGrams,
      trackingCode: record.trackingCode,
      trackingUrl: record.trackingUrl,
    },
    note: record.note,
    address: record.addressSnapshot as unknown as AddressSnapshot,
    items,
    payment,
    canCancel: record.status === OrderStatus.Pending && !captured,
    statusHistory: record.statusHistory.map((event) => ({
      from: event.fromStatus as OrderStatus | null,
      to: event.toStatus as OrderStatus,
      note: event.note,
      at: event.created_at,
    })),
    returns: record.returnRequests.map(toReturnView),
    refunds: record.refunds.map((refund) => ({
      id: refund.id,
      amount: refund.amount,
      reference: refund.reference,
      paidAt: refund.paidAt,
      restocked: refund.restocked,
      returnRequestId: refund.returnRequestId,
      note: refund.note,
    })),
    returnableUntil:
      record.status === OrderStatus.Completed && record.completedAt
        ? ReturnRequest.windowEnd(record.completedAt, returnWindowDays)
        : null,
    cancelledAt: record.cancelledAt,
    paidAt: record.paidAt,
    processingAt: record.processingAt,
    shippedAt: record.shippedAt,
    completedAt: record.completedAt,
    createdAt: record.created_at,
  }
}

function toPaymentView(record: OrderRecord['payments'][number] | null): OrderPaymentView | null {
  if (!record) {
    return null
  }

  const requiresRefund =
    record.status === PaymentStatus.Succeeded &&
    record.failureReason !== null &&
    record.failureReason.startsWith(REFUND_REQUIRED_PREFIX)

  return {
    id: record.id,
    status: record.status,
    requiresRefund,
    failureReason: record.failureReason,
    gatewayRef: record.gatewayRef,
  }
}
