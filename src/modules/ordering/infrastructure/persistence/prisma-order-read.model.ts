import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '@shared/infrastructure/persistence/prisma/prisma.service'
import { AddressSnapshot } from '../../domain/entities/order.aggregate'
import { OrderProductSnapshot } from '../../domain/entities/order-item.entity'
import { OrderStatus, PaymentMethod } from '../../domain/enums/order.enums'
import {
  ListOrdersQuery,
  OrderItemView,
  OrderView,
  PaginatedOrdersView,
} from '../../application/dto/views'
import { OrderReadModel } from '../../application/ports/order-read.port'

@Injectable()
export class PrismaOrderReadModel implements OrderReadModel {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: number): Promise<OrderView | null> {
    const record = await this.prisma.order.findUnique({
      where: { id },
      include: { items: { orderBy: { id: 'asc' } } },
    })

    return record ? toView(record) : null
  }

  async list(
    query: Required<Pick<ListOrdersQuery, 'limit' | 'offset'>> & ListOrdersQuery
  ): Promise<PaginatedOrdersView> {
    const where = toWhere(query)

    const [total, records] = await this.prisma.$transaction([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        include: { items: { orderBy: { id: 'asc' } } },
        orderBy: { created_at: 'desc' },
        take: query.limit,
        skip: query.offset,
      }),
    ])

    return {
      items: records.map(toView),
      total,
      limit: query.limit,
      offset: query.offset,
    }
  }
}

type OrderRecord = Prisma.orderGetPayload<{
  include: { items: true }
}>

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

function toView(record: OrderRecord): OrderView {
  const items: OrderItemView[] = record.items.map((item) => ({
    id: item.id,
    variantId: item.variantId,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    lineTotal: item.lineTotal,
    product: item.productSnapshot as unknown as OrderProductSnapshot,
  }))

  return {
    id: record.id,
    number: record.number,
    userId: record.userId,
    status: record.status as OrderStatus,
    paymentMethod: record.paymentMethod as PaymentMethod,
    itemCount: record.itemCount,
    subtotal: record.subtotal,
    note: record.note,
    address: record.addressSnapshot as unknown as AddressSnapshot,
    items,
    canCancel: record.status === OrderStatus.Pending,
    cancelledAt: record.cancelledAt,
    paidAt: record.paidAt,
    completedAt: record.completedAt,
    createdAt: record.created_at,
  }
}
