import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { isUnsaved } from '@shared/domain/identifier'
import { PrismaService } from '@shared/infrastructure/persistence/prisma/prisma.service'
import { ReturnRequest } from '../../domain/entities/return-request.aggregate'
import { ReturnRequestStatus } from '../../domain/enums/order.enums'
import { ReturnRequestRepository } from '../../domain/repositories/return-request.repository'

const withItems = { items: { orderBy: { id: 'asc' } } } satisfies Prisma.return_requestInclude
type Record = Prisma.return_requestGetPayload<{ include: typeof withItems }>
type Client = Prisma.TransactionClient | PrismaService

@Injectable()
export class PrismaReturnRequestRepository implements ReturnRequestRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: number, tx?: unknown): Promise<ReturnRequest | null> {
    const record = await this.client(tx).return_request.findUnique({
      where: { id },
      include: withItems,
    })
    return record ? toDomain(record) : null
  }

  async listByOrder(orderId: number, tx?: unknown): Promise<ReturnRequest[]> {
    const records = await this.client(tx).return_request.findMany({
      where: { orderId },
      include: withItems,
      orderBy: { id: 'asc' },
    })
    return records.map(toDomain)
  }

  async save(request: ReturnRequest, tx?: unknown): Promise<ReturnRequest> {
    const client = this.client(tx)
    const data = {
      status: request.status,
      adminNote: request.adminNote,
      decidedAt: request.decidedAt,
    }

    const record = isUnsaved(request.id)
      ? await client.return_request.create({
          data: {
            ...data,
            orderId: request.orderId,
            userId: request.userId,
            reason: request.reason,
            created_at: request.createdAt,
            items: {
              create: request.items.map((line) => ({
                orderItemId: line.orderItemId,
                quantity: line.quantity,
              })),
            },
          },
          include: withItems,
        })
      : await client.return_request.update({
          where: { id: request.id },
          data,
          include: withItems,
        })

    return toDomain(record)
  }

  private client(tx?: unknown): Client {
    return (tx as Prisma.TransactionClient | undefined) ?? this.prisma
  }
}

function toDomain(record: Record): ReturnRequest {
  return ReturnRequest.fromPersistence(record.id, {
    orderId: record.orderId,
    userId: record.userId,
    status: record.status as ReturnRequestStatus,
    reason: record.reason,
    adminNote: record.adminNote,
    items: record.items.map((item) => ({
      orderItemId: item.orderItemId,
      quantity: item.quantity,
    })),
    decidedAt: record.decidedAt,
    createdAt: record.created_at,
  })
}
