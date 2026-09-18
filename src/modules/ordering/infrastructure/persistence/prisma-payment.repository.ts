import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '@shared/infrastructure/persistence/prisma/prisma.service'
import { Payment } from '../../domain/entities/payment.entity'
import { PaymentStatus } from '../../domain/enums/order.enums'
import { PaymentRepository } from '../../domain/repositories/payment.repository'

@Injectable()
export class PrismaPaymentRepository implements PaymentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: number): Promise<Payment | null> {
    const record = await this.prisma.payment.findUnique({ where: { id } })
    return record ? toDomain(record) : null
  }

  async findByIdempotencyKey(key: string): Promise<Payment | null> {
    const record = await this.prisma.payment.findUnique({ where: { idempotencyKey: key } })
    return record ? toDomain(record) : null
  }

  async findByGatewayRef(gatewayRef: string): Promise<Payment | null> {
    const record = await this.prisma.payment.findUnique({ where: { gatewayRef } })
    return record ? toDomain(record) : null
  }

  async findInFlightByOrderId(orderId: number, tx?: unknown): Promise<Payment | null> {
    const client = (tx as Prisma.TransactionClient | undefined) ?? this.prisma
    const record = await client.payment.findFirst({
      where: {
        orderId,
        status: { in: [PaymentStatus.Initiated, PaymentStatus.Succeeded] },
      },
      orderBy: { id: 'desc' },
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
    const record = await client.payment.findUnique({ where: { id } })
    return record ? toDomain(record) : null
  }

  async save(payment: Payment, tx?: unknown): Promise<Payment> {
    const client = (tx as Prisma.TransactionClient | undefined) ?? this.prisma

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
      })
      return toDomain(record)
    }

    const record = await client.payment.update({
      where: { id: payment.id },
      data: {
        status: payment.status,
        failureReason: payment.failureReason,
        gatewayRef: payment.gatewayRef,
        redirectUrl: payment.redirectUrl,
        updated_at: payment.updatedAt,
      },
    })
    return toDomain(record)
  }

  private requireTx(tx: unknown): Prisma.TransactionClient {
    if (!tx) {
      throw new Error('Payment lock requires an open Prisma transaction')
    }
    return tx as Prisma.TransactionClient
  }
}

type PaymentRecord = {
  id: number
  orderId: number
  idempotencyKey: string
  gatewayRef: string | null
  amount: number
  status: string
  failureReason: string | null
  redirectUrl: string | null
  created_at: Date
  updated_at: Date | null
}

function toDomain(record: PaymentRecord): Payment {
  return Payment.fromPersistence(record.id, {
    orderId: record.orderId,
    idempotencyKey: record.idempotencyKey,
    gatewayRef: record.gatewayRef,
    amount: record.amount,
    status: record.status as PaymentStatus,
    failureReason: record.failureReason,
    redirectUrl: record.redirectUrl,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  })
}
