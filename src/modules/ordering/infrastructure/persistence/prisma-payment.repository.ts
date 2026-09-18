import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '@shared/infrastructure/persistence/prisma/prisma.service'
import { Payment, REFUND_REQUIRED_PREFIX } from '../../domain/entities/payment.entity'
import { OrderStatus, PaymentStatus } from '../../domain/enums/order.enums'
import {
  PAYMENT_INQUIRY_BATCH_LIMIT,
  PAYMENT_INQUIRY_MAX_AGE_MS,
} from '../../domain/payment-inquiry'
import { PaymentRepository } from '../../domain/repositories/payment.repository'

const withTracks = { tracks: true } as const

@Injectable()
export class PrismaPaymentRepository implements PaymentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: number): Promise<Payment | null> {
    const record = await this.prisma.payment.findUnique({
      where: { id },
      include: withTracks,
    })
    return record ? toDomain(record) : null
  }

  async findByIdempotencyKey(key: string): Promise<Payment | null> {
    const record = await this.prisma.payment.findUnique({
      where: { idempotencyKey: key },
      include: withTracks,
    })
    return record ? toDomain(record) : null
  }

  async findByGatewayRef(gatewayRef: string): Promise<Payment | null> {
    const track = await this.prisma.payment_gateway_ref.findUnique({
      where: { gatewayRef },
      select: { paymentId: true },
    })
    if (track) {
      return this.findById(track.paymentId)
    }

    const record = await this.prisma.payment.findUnique({
      where: { gatewayRef },
      include: withTracks,
    })
    return record ? toDomain(record) : null
  }

  async findInFlightByOrderId(orderId: number, tx?: unknown): Promise<Payment | null> {
    const client = this.client(tx)
    const record = await client.payment.findFirst({
      where: {
        orderId,
        status: { in: [PaymentStatus.Initiated, PaymentStatus.Failed, PaymentStatus.Succeeded] },
      },
      orderBy: { id: 'desc' },
      include: withTracks,
    })
    return record ? toDomain(record) : null
  }

  async findByIdForUpdate(id: number, tx: unknown): Promise<Payment | null> {
    const client = this.requireTx(tx)
    const locked = await client.$queryRaw<{ id: number }[]>`
      SELECT id FROM payment WHERE id = ${id} FOR UPDATE
    `
    if (locked.length === 0) {
      return null
    }
    const record = await client.payment.findUnique({
      where: { id },
      include: withTracks,
    })
    return record ? toDomain(record) : null
  }

  async listOpenForInquiry(
    limit = PAYMENT_INQUIRY_BATCH_LIMIT,
    now = new Date()
  ): Promise<Payment[]> {
    const since = new Date(now.getTime() - PAYMENT_INQUIRY_MAX_AGE_MS)
    const captured = await this.prisma.payment.findMany({
      where: {
        status: PaymentStatus.Succeeded,
        AND: [
          {
            OR: [
              { failureReason: null },
              { failureReason: { not: { startsWith: REFUND_REQUIRED_PREFIX } } },
            ],
          },
        ],
        order: { status: { in: [OrderStatus.Pending, OrderStatus.Cancelled] } },
      },
      orderBy: { id: 'asc' },
      take: limit,
      include: withTracks,
    })

    const remaining = limit - captured.length
    if (remaining <= 0) {
      return captured.map(toDomain)
    }

    const sessions = await this.prisma.payment.findMany({
      where: {
        OR: [
          {
            status: PaymentStatus.Initiated,
            gatewayRef: { not: null },
            created_at: { gte: since },
            order: { status: OrderStatus.Pending },
          },
          {
            status: PaymentStatus.Failed,
            gatewayRef: { not: null },
            created_at: { gte: since },
            order: { status: { in: [OrderStatus.Pending, OrderStatus.Cancelled] } },
          },
        ],
      },
      orderBy: { id: 'desc' },
      take: remaining,
      include: withTracks,
    })

    return [...captured, ...sessions].map(toDomain)
  }

  async save(payment: Payment, tx?: unknown): Promise<Payment> {
    const client = this.client(tx)

    if (payment.isNew) {
      const record = await client.payment.create({
        data: {
          orderId: payment.orderId,
          idempotencyKey: payment.idempotencyKey,
          gatewayRef: payment.gatewayRef,
          amount: payment.amount,
          status: payment.status,
          failureReason: payment.failureReason,
          redirectUrl: payment.redirectUrl,
        },
        include: withTracks,
      })
      await this.rememberRefs(client, record.id, payment.knownGatewayRefs)
      return this.reload(client, record.id)
    }

    await client.payment.update({
      where: { id: payment.id },
      data: {
        status: payment.status,
        failureReason: payment.failureReason,
        gatewayRef: payment.gatewayRef,
        redirectUrl: payment.redirectUrl,
        updated_at: payment.updatedAt,
      },
    })
    await this.rememberRefs(client, payment.id, payment.knownGatewayRefs)
    return this.reload(client, payment.id)
  }

  private async rememberRefs(
    client: Prisma.TransactionClient | PrismaService,
    paymentId: number,
    refs: readonly string[]
  ): Promise<void> {
    for (const gatewayRef of refs) {
      await client.payment_gateway_ref.upsert({
        where: { gatewayRef },
        create: { gatewayRef, paymentId },
        update: { paymentId },
      })
    }
  }

  private async reload(
    client: Prisma.TransactionClient | PrismaService,
    id: number
  ): Promise<Payment> {
    const record = await client.payment.findUnique({
      where: { id },
      include: withTracks,
    })
    if (!record) {
      throw new Error(`Payment ${id} disappeared after save`)
    }
    return toDomain(record)
  }

  private client(tx?: unknown): Prisma.TransactionClient | PrismaService {
    return (tx as Prisma.TransactionClient | undefined) ?? this.prisma
  }

  private requireTx(tx: unknown): Prisma.TransactionClient {
    if (!tx) {
      throw new Error('Payment lock requires an open Prisma transaction')
    }
    return tx as Prisma.TransactionClient
  }
}

type PaymentRecord = Prisma.paymentGetPayload<{ include: typeof withTracks }>

function toDomain(record: PaymentRecord): Payment {
  return Payment.fromPersistence(record.id, {
    orderId: record.orderId,
    idempotencyKey: record.idempotencyKey,
    gatewayRef: record.gatewayRef,
    knownGatewayRefs: record.tracks.map((track) => track.gatewayRef),
    amount: record.amount,
    status: record.status as PaymentStatus,
    failureReason: record.failureReason,
    redirectUrl: record.redirectUrl,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  })
}
