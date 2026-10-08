import { Injectable } from '@nestjs/common'
import { Prisma, promotion as PromotionRecord } from '@prisma/client'
import { isUnsaved } from '@shared/domain/identifier'
import { ConflictError } from '@shared/domain/errors'
import { PrismaService } from '@shared/infrastructure/persistence/prisma/prisma.service'
import { isUniqueConstraintError } from '@shared/infrastructure/persistence/prisma/prisma-errors'
import { PromotionRepository } from '../application/promotion.ports'
import { Promotion, PromotionKind } from '../domain/promotion.entity'

type Client = Prisma.TransactionClient | PrismaService

const idList = (value: Prisma.JsonValue | null): number[] | null =>
  Array.isArray(value) ? (value as number[]) : null

@Injectable()
export class PrismaPromotionRepository implements PromotionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: number): Promise<Promotion | null> {
    const record = await this.prisma.promotion.findUnique({ where: { id } })
    return record ? toDomain(record) : null
  }

  async findByCode(code: string): Promise<Promotion | null> {
    const record = await this.prisma.promotion.findUnique({ where: { code } })
    return record ? toDomain(record) : null
  }

  async listLiveCampaigns(now: Date): Promise<Promotion[]> {
    const records = await this.prisma.promotion.findMany({
      where: {
        code: null,
        is_active: true,
        starts_at: { lte: now },
        OR: [{ ends_at: null }, { ends_at: { gt: now } }],
      },
      orderBy: { id: 'asc' },
    })
    return records.map(toDomain)
  }

  async list(): Promise<Promotion[]> {
    const records = await this.prisma.promotion.findMany({ orderBy: { id: 'desc' } })
    return records.map(toDomain)
  }

  async save(promotion: Promotion): Promise<Promotion> {
    const data = {
      name: promotion.name,
      code: promotion.code,
      kind: promotion.kind,
      value: promotion.value,
      max_discount: promotion.maxDiscount,
      min_subtotal: promotion.minSubtotal,
      starts_at: promotion.startsAt,
      ends_at: promotion.endsAt,
      usage_limit: promotion.usageLimit,
      per_customer_limit: promotion.perCustomerLimit,
      category_ids: promotion.categoryIds ?? Prisma.DbNull,
      brand_ids: promotion.brandIds ?? Prisma.DbNull,
      is_active: promotion.isActive,
    }
    try {
      const record = isUnsaved(promotion.id)
        ? await this.prisma.promotion.create({ data })
        : await this.prisma.promotion.update({ where: { id: promotion.id }, data })
      return toDomain(record)
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictError('Another promotion already uses this code', {
          code: promotion.code,
        })
      }
      throw error
    }
  }

  async delete(id: number): Promise<void> {
    await this.prisma.promotion.delete({ where: { id } })
  }

  async findByIdForUpdate(id: number, tx: unknown): Promise<Promotion | null> {
    const client = tx as Prisma.TransactionClient
    await client.$queryRaw`SELECT id FROM promotion WHERE id = ${id} FOR UPDATE`
    const record = await client.promotion.findUnique({ where: { id } })
    return record ? toDomain(record) : null
  }

  countRedemptions(promotionId: number, userId: number, tx?: unknown): Promise<number> {
    return this.client(tx).promotion_redemption.count({ where: { promotionId, userId } })
  }

  async addRedemption(
    input: { promotionId: number; orderId: number; userId: number; amount: number },
    tx: unknown
  ): Promise<void> {
    const client = tx as Prisma.TransactionClient
    await client.promotion_redemption.create({ data: input })
    await client.promotion.update({
      where: { id: input.promotionId },
      data: { used_count: { increment: 1 } },
    })
  }

  async releaseRedemption(orderId: number, tx: unknown): Promise<void> {
    const client = tx as Prisma.TransactionClient
    const redemption = await client.promotion_redemption.findUnique({ where: { orderId } })
    if (!redemption) return
    await client.promotion_redemption.delete({ where: { orderId } })
    await client.promotion.update({
      where: { id: redemption.promotionId },
      data: { used_count: { decrement: 1 } },
    })
  }

  private client(tx?: unknown): Client {
    return (tx as Prisma.TransactionClient | undefined) ?? this.prisma
  }
}

function toDomain(record: PromotionRecord): Promotion {
  return Promotion.fromPersistence(record.id, {
    name: record.name,
    code: record.code,
    kind: record.kind as PromotionKind,
    value: record.value,
    maxDiscount: record.max_discount,
    minSubtotal: record.min_subtotal,
    startsAt: record.starts_at,
    endsAt: record.ends_at,
    usageLimit: record.usage_limit,
    perCustomerLimit: record.per_customer_limit,
    categoryIds: idList(record.category_ids),
    brandIds: idList(record.brand_ids),
    isActive: record.is_active,
    usedCount: record.used_count,
  })
}
