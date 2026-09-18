import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '@shared/infrastructure/persistence/prisma/prisma.service'
import { Order } from '../../domain/entities/order.aggregate'
import { OrderItem } from '../../domain/entities/order-item.entity'
import { OrderReservationStatus, OrderStatus, PaymentMethod } from '../../domain/enums/order.enums'
import { OrderConflictError } from '../../domain/errors/ordering.errors'
import { OrderRepository } from '../../domain/repositories/order.repository'
import { StockAllocationPlan } from '../../domain/value-objects/stock-allocation.vo'
import { OrderProductSnapshot } from '../../domain/entities/order-item.entity'
import { AddressSnapshot } from '../../domain/entities/order.aggregate'

const withItems = { items: true } as const

@Injectable()
export class PrismaOrderRepository implements OrderRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: number): Promise<Order | null> {
    return this.loadById(this.prisma, id)
  }

  async findByNumber(number: string): Promise<Order | null> {
    const record = await this.prisma.order.findUnique({
      where: { number },
      include: withItems,
    })
    return record ? toDomain(record) : null
  }

  async findByIdForUpdate(id: number, tx: unknown): Promise<Order | null> {
    const client = this.requireTx(tx)
    const locked = await client.$queryRaw<{ id: number }[]>`
      SELECT id FROM \`order\` WHERE id = ${id} FOR UPDATE
    `
    if (locked.length === 0) {
      return null
    }
    return this.loadById(client, id)
  }

  async create(order: Order, tx?: unknown): Promise<Order> {
    const client = this.client(tx)

    const record = await client.order.create({
      data: {
        number: order.number,
        userId: order.userId,
        status: order.status,
        reservationStatus: order.reservationStatus,
        paymentMethod: order.paymentMethod,
        itemCount: order.itemCount,
        subtotal: order.subtotal.amount,
        addressSnapshot: order.addressSnapshot as unknown as Prisma.InputJsonValue,
        note: order.note,
        stockAllocations: order.stockAllocations.toJSON() as unknown as Prisma.InputJsonValue,
        items: {
          create: order.items.map((item) => ({
            variantId: item.variantId,
            quantity: item.quantity,
            unitPrice: item.unitPrice.amount,
            lineTotal: item.lineTotal.amount,
            productSnapshot: item.productSnapshot as unknown as Prisma.InputJsonValue,
          })),
        },
      },
      include: withItems,
    })

    return toDomain(record)
  }

  async save(order: Order, tx?: unknown): Promise<Order> {
    const client = this.client(tx)
    const record = await client.order.update({
      where: { id: order.id },
      data: this.mutation(order),
      include: withItems,
    })
    return toDomain(record)
  }

  async saveIfStatus(order: Order, expectedStatus: OrderStatus, tx?: unknown): Promise<Order> {
    const client = this.client(tx)
    const result = await client.order.updateMany({
      where: { id: order.id, status: expectedStatus },
      data: this.mutation(order),
    })

    if (result.count !== 1) {
      throw new OrderConflictError({ order: order.id, expectedStatus })
    }

    const saved = await this.loadById(client, order.id)
    if (!saved) {
      throw new OrderConflictError({ order: order.id, expectedStatus })
    }
    return saved
  }

  async nextDailySequence(dayKey: string, tx?: unknown): Promise<number> {
    const client = this.client(tx)
    const prefix = `ORD-${dayKey}-`
    const like = `${prefix}%`
    const latest = await client.$queryRaw<{ number: string }[]>`
      SELECT number FROM \`order\`
      WHERE number LIKE ${like}
      ORDER BY number DESC
      LIMIT 1
      FOR UPDATE
    `

    if (latest.length === 0) {
      return 1
    }

    const suffix = latest[0].number.slice(prefix.length)
    const parsed = Number.parseInt(suffix, 10)
    return Number.isFinite(parsed) ? parsed + 1 : 1
  }

  private mutation(order: Order) {
    return {
      status: order.status,
      reservationStatus: order.reservationStatus,
      stockAllocations: order.stockAllocations.toJSON() as unknown as Prisma.InputJsonValue,
      cancelledAt: order.cancelledAt,
      paidAt: order.paidAt,
      completedAt: order.completedAt,
    }
  }

  private async loadById(client: Client, id: number): Promise<Order | null> {
    const record = await client.order.findUnique({
      where: { id },
      include: withItems,
    })
    return record ? toDomain(record) : null
  }

  private client(tx?: unknown): Client {
    return (tx as Prisma.TransactionClient | undefined) ?? this.prisma
  }

  private requireTx(tx: unknown): Prisma.TransactionClient {
    if (!tx) {
      throw new Error('Order lock requires an open Prisma transaction')
    }
    return tx as Prisma.TransactionClient
  }
}

type Client = Prisma.TransactionClient | PrismaService

type OrderRecord = Prisma.orderGetPayload<{ include: typeof withItems }>

function toDomain(record: OrderRecord): Order {
  return Order.fromPersistence(record.id, {
    number: record.number,
    userId: record.userId,
    status: record.status as OrderStatus,
    reservationStatus: record.reservationStatus as OrderReservationStatus,
    paymentMethod: record.paymentMethod as PaymentMethod,
    items: record.items.map((item) =>
      OrderItem.fromPersistence({
        id: item.id,
        variantId: item.variantId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
        productSnapshot: item.productSnapshot as unknown as OrderProductSnapshot,
      })
    ),
    addressSnapshot: record.addressSnapshot as unknown as AddressSnapshot,
    note: record.note,
    stockAllocations: StockAllocationPlan.fromJSON(record.stockAllocations),
    cancelledAt: record.cancelledAt,
    paidAt: record.paidAt,
    completedAt: record.completedAt,
    createdAt: record.created_at,
  })
}
