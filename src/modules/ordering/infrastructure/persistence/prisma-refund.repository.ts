import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { Money } from '@shared/domain/value-objects/money'
import { PrismaService } from '@shared/infrastructure/persistence/prisma/prisma.service'
import { Refund } from '../../domain/entities/refund.entity'
import { RefundRepository } from '../../domain/repositories/refund.repository'

@Injectable()
export class PrismaRefundRepository implements RefundRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(refund: Refund, tx?: unknown): Promise<Refund> {
    const client = (tx as Prisma.TransactionClient | undefined) ?? this.prisma
    const record = await client.refund.create({
      data: {
        orderId: refund.orderId,
        returnRequestId: refund.returnRequestId,
        amount: refund.amount.amount,
        restocked: refund.restocked,
        reference: refund.reference,
        note: refund.note,
        paidAt: refund.paidAt,
        adminId: refund.adminId,
        created_at: refund.createdAt,
      },
    })

    return Refund.fromPersistence(record.id, {
      orderId: record.orderId,
      returnRequestId: record.returnRequestId,
      amount: Money.fromMinor(record.amount),
      restocked: record.restocked,
      reference: record.reference,
      note: record.note,
      paidAt: record.paidAt,
      adminId: record.adminId,
      createdAt: record.created_at,
    })
  }
}
