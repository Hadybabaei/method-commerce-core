import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { BusinessRuleViolationError, InvalidInputError, NotFoundError } from '@shared/domain/errors'
import { PrismaService } from '@shared/infrastructure/persistence/prisma/prisma.service'
import { StockMovementView, StockRowView, StockService } from '../application/backoffice.ports'

const variantInclude = {
  product: { select: { id: true, title: true } },
  inventory: { include: { location: { select: { name: true } } }, orderBy: { locationId: 'asc' } },
  optionValues: { include: { optionValue: { include: { option: true } } } },
} satisfies Prisma.product_variantInclude

type VariantRecord = Prisma.product_variantGetPayload<{ include: typeof variantInclude }>

export function toStockRow(variant: VariantRecord): StockRowView {
  const onHand = variant.inventory.reduce((sum, level) => sum + level.on_hand, 0)
  const reserved = variant.inventory.reduce((sum, level) => sum + level.reserved, 0)
  const available = onHand - reserved
  return {
    variantId: variant.id,
    sku: variant.sku,
    productId: variant.product.id,
    productTitle: variant.product.title,
    options: variant.optionValues.map((link) => ({
      option: link.optionValue.option.name,
      value: link.optionValue.value,
    })),
    isActive: variant.is_active,
    lowStockThreshold: variant.low_stock_threshold,
    onHand,
    reserved,
    available,
    isLow: variant.low_stock_threshold !== null && available <= variant.low_stock_threshold,
    levels: variant.inventory.map((level) => ({
      locationId: level.locationId,
      locationName: level.location.name,
      onHand: level.on_hand,
      reserved: level.reserved,
    })),
  }
}

/** Stock levels per variant and warehouse, manual adjustments and low-stock thresholds. */
@Injectable()
export class PrismaStockService implements StockService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: { search?: string; lowOnly?: boolean; limit: number; offset: number }) {
    const search = query.search?.trim()
    const where: Prisma.product_variantWhereInput = {
      ...(search
        ? {
            OR: [
              { sku: { contains: search, mode: 'insensitive' } },
              { product: { title: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
      ...(query.lowOnly ? { low_stock_threshold: { not: null } } : {}),
    }

    if (query.lowOnly) {
      // "Low" depends on summed levels, so filter after loading the variants that have a threshold.
      const all = (
        await this.prisma.product_variant.findMany({
          where,
          include: variantInclude,
          orderBy: { id: 'asc' },
        })
      )
        .map(toStockRow)
        .filter((row) => row.isLow)
      return {
        items: all.slice(query.offset, query.offset + query.limit),
        total: all.length,
        limit: query.limit,
        offset: query.offset,
      }
    }

    const [total, variants] = await this.prisma.$transaction([
      this.prisma.product_variant.count({ where }),
      this.prisma.product_variant.findMany({
        where,
        include: variantInclude,
        orderBy: { id: 'asc' },
        take: query.limit,
        skip: query.offset,
      }),
    ])
    return { items: variants.map(toStockRow), total, limit: query.limit, offset: query.offset }
  }

  async adjust(input: {
    variantId: number
    locationId?: number
    delta: number
    reason: string
    adminId: number
  }): Promise<StockRowView> {
    const reason = input.reason.trim()
    if (!Number.isInteger(input.delta) || input.delta === 0) {
      throw new InvalidInputError('Adjustment must be a whole number other than 0')
    }
    if (reason.length < 3) {
      throw new InvalidInputError('Say why the stock is changing (at least 3 characters)')
    }

    await this.prisma.$transaction(async (tx) => {
      const variant = await tx.product_variant.findUnique({ where: { id: input.variantId } })
      if (!variant) {
        throw new NotFoundError('Variant not found', { variant: input.variantId })
      }
      const locationId = input.locationId ?? (await this.defaultLocationId(tx))
      if (locationId === null) {
        throw new BusinessRuleViolationError('No active warehouse to adjust')
      }

      // Same lock checkout takes, so a sale and an adjustment cannot interleave.
      const [level] = await tx.$queryRaw<{ on_hand: number; reserved: number }[]>`
        SELECT on_hand, reserved FROM inventory_level
        WHERE "variantId" = ${input.variantId} AND "locationId" = ${locationId}
        FOR UPDATE
      `
      const onHand = (level?.on_hand ?? 0) + input.delta
      const reserved = level?.reserved ?? 0
      if (onHand < reserved) {
        throw new BusinessRuleViolationError('Cannot go below the units reserved by open orders', {
          onHand: level?.on_hand ?? 0,
          reserved,
          delta: input.delta,
        })
      }

      await tx.inventory_level.upsert({
        where: { variantId_locationId: { variantId: input.variantId, locationId } },
        create: { variantId: input.variantId, locationId, on_hand: onHand, reserved: 0 },
        update: { on_hand: onHand },
      })
      await tx.stock_movement.create({
        data: {
          variantId: input.variantId,
          locationId,
          delta: input.delta,
          onHandAfter: onHand,
          reason,
          adminId: input.adminId,
        },
      })
    })

    return this.row(input.variantId)
  }

  async setThreshold(variantId: number, threshold: number | null): Promise<StockRowView> {
    if (threshold !== null && (!Number.isInteger(threshold) || threshold < 0)) {
      throw new InvalidInputError('Threshold must be a whole number of 0 or more, or null')
    }
    try {
      await this.prisma.product_variant.update({
        where: { id: variantId },
        data: { low_stock_threshold: threshold },
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundError('Variant not found', { variant: variantId })
      }
      throw error
    }
    return this.row(variantId)
  }

  async movements(variantId: number, limit: number): Promise<StockMovementView[]> {
    const rows = await this.prisma.stock_movement.findMany({
      where: { variantId },
      orderBy: { id: 'desc' },
      take: limit,
    })
    return rows.map((row) => ({
      id: row.id,
      locationId: row.locationId,
      delta: row.delta,
      onHandAfter: row.onHandAfter,
      reason: row.reason,
      adminId: row.adminId,
      createdAt: row.created_at,
    }))
  }

  private async row(variantId: number): Promise<StockRowView> {
    const variant = await this.prisma.product_variant.findUnique({
      where: { id: variantId },
      include: variantInclude,
    })
    if (!variant) {
      throw new NotFoundError('Variant not found', { variant: variantId })
    }
    return toStockRow(variant)
  }

  private async defaultLocationId(tx: Prisma.TransactionClient): Promise<number | null> {
    const location = await tx.inventory_location.findFirst({
      where: { is_active: true },
      orderBy: { id: 'asc' },
      select: { id: true },
    })
    return location?.id ?? null
  }
}
