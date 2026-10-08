import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '@shared/infrastructure/persistence/prisma/prisma.service'
import {
  DueAlert,
  StockAlertStore,
  StockAlertView,
  VariantForAlert,
} from '../application/stock-alerts'

const variantInclude = {
  product: { select: { id: true, title: true, slug: true, publish: true } },
  optionValues: {
    select: { optionValue: { select: { value: true, option: { select: { name: true } } } } },
  },
  inventory: { select: { on_hand: true, reserved: true } },
} satisfies Prisma.product_variantInclude

type VariantRecord = Prisma.product_variantGetPayload<{ include: typeof variantInclude }>

const optionsOf = (variant: VariantRecord) =>
  variant.optionValues.map(({ optionValue }) => ({
    option: optionValue.option.name,
    value: optionValue.value,
  }))

const available = (variant: VariantRecord) =>
  variant.inventory.reduce((sum, level) => sum + Math.max(0, level.on_hand - level.reserved), 0)

@Injectable()
export class PrismaStockAlertStore implements StockAlertStore {
  constructor(private readonly prisma: PrismaService) {}

  async variant(variantId: number): Promise<VariantForAlert | null> {
    const variant = await this.prisma.product_variant.findUnique({
      where: { id: variantId },
      include: variantInclude,
    })
    if (!variant) return null
    return {
      variantId: variant.id,
      productId: variant.product.id,
      title: variant.product.title,
      slug: variant.product.slug,
      options: optionsOf(variant),
      sellable: variant.is_active && variant.product.publish,
      availableQuantity: available(variant),
    }
  }

  async subscribe(userId: number, variantId: number, now: Date): Promise<void> {
    await this.prisma.stock_alert.upsert({
      where: { userId_variantId: { userId, variantId } },
      create: { userId, variantId, created_at: now },
      update: { notified_at: null, created_at: now },
    })
  }

  async unsubscribe(userId: number, variantId: number): Promise<boolean> {
    const { count } = await this.prisma.stock_alert.deleteMany({
      where: { userId, variantId, notified_at: null },
    })
    return count > 0
  }

  async waiting(userId: number): Promise<StockAlertView[]> {
    const alerts = await this.prisma.stock_alert.findMany({
      where: { userId, notified_at: null },
      orderBy: { created_at: 'desc' },
      include: { variant: { include: variantInclude } },
    })
    return alerts.map((alert) => ({
      variantId: alert.variantId,
      productId: alert.variant.product.id,
      title: alert.variant.product.title,
      slug: alert.variant.product.slug,
      options: optionsOf(alert.variant),
      createdAt: alert.created_at,
    }))
  }

  async due(variantIds: number[] | null, limit: number): Promise<DueAlert[]> {
    if (variantIds && variantIds.length === 0) return []
    // Candidates first in SQL (waiting, sellable, stock on hand), then exact availability below.
    const alerts = await this.prisma.stock_alert.findMany({
      where: {
        notified_at: null,
        ...(variantIds ? { variantId: { in: variantIds } } : {}),
        variant: {
          is_active: true,
          product: { publish: true },
          inventory: { some: { on_hand: { gt: 0 } } },
        },
        user: { blocked_at: null },
      },
      orderBy: { created_at: 'asc' },
      take: limit,
      include: { user: { select: { phone_number: true } }, variant: { include: variantInclude } },
    })
    return alerts
      .filter((alert) => available(alert.variant) > 0)
      .map((alert) => ({
        alertId: alert.id,
        phoneNumber: alert.user.phone_number,
        title: alert.variant.product.title,
        slug: alert.variant.product.slug,
        options: optionsOf(alert.variant),
      }))
  }

  async claim(alertId: number, now: Date): Promise<boolean> {
    const { count } = await this.prisma.stock_alert.updateMany({
      where: { id: alertId, notified_at: null },
      data: { notified_at: now },
    })
    return count === 1
  }

  async release(alertId: number): Promise<void> {
    await this.prisma.stock_alert.updateMany({
      where: { id: alertId },
      data: { notified_at: null },
    })
  }

  async variantsOfProducts(productIds: number[]): Promise<number[]> {
    if (productIds.length === 0) return []
    const variants = await this.prisma.product_variant.findMany({
      where: { productId: { in: productIds } },
      select: { id: true },
    })
    return variants.map((variant) => variant.id)
  }
}
