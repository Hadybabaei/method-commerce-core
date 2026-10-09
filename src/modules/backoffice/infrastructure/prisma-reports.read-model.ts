import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '@shared/infrastructure/persistence/prisma/prisma.service'
import {
  CategorySalesRow,
  DashboardView,
  DateRange,
  PaymentConversionView,
  ProductSalesRow,
  ReportsReadModel,
  SalesPoint,
} from '../application/backoffice.ports'
import { toCsv } from '../domain/csv'
import { TEHRAN_OFFSET_INTERVAL, startOfTehranDay, startOfTehranMonth } from '../domain/tehran-time'

const MAX_CSV_ROWS = 50_000
const toNumber = (value: unknown) => Number(value ?? 0)

/**
 * A sale is an order that was paid (paidAt set) and not cancelled, counted on
 * the Tehran day it was paid. Sales amounts are total minus refunds.
 */
@Injectable()
export class PrismaReportsReadModel implements ReportsReadModel {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(now: Date): Promise<DashboardView> {
    const [today, month, pendingOrders, toFulfil, lowStockVariants, openReturns] =
      await Promise.all([
        this.salesBetween({ from: startOfTehranDay(now), to: now }),
        this.salesBetween({ from: startOfTehranMonth(now), to: now }),
        this.prisma.order.count({ where: { status: 'PENDING' } }),
        this.prisma.order.count({ where: { status: { in: ['PAID', 'PROCESSING'] } } }),
        this.lowStockCount(),
        this.prisma.return_request.count({ where: { status: 'REQUESTED' } }),
      ])

    return {
      today,
      month,
      averageOrderValue: month.orders > 0 ? Math.round(month.sales / month.orders) : 0,
      pendingOrders,
      toFulfil,
      lowStockVariants,
      openReturns,
    }
  }

  async salesByDay({ from, to }: DateRange): Promise<SalesPoint[]> {
    const rows = await this.prisma.$queryRaw<
      { day: Date | string; orders: bigint; sales: unknown }[]
    >`
      SELECT ("paidAt" + ${TEHRAN_OFFSET_INTERVAL}::interval)::date AS day,
             COUNT(*) AS orders,
             SUM(total - "refundedTotal") AS sales
      FROM "order"
      WHERE "paidAt" >= ${from} AND "paidAt" < ${to} AND status <> 'CANCELLED'
      GROUP BY day
      ORDER BY day
    `
    return rows.map((row) => ({
      day: row.day instanceof Date ? row.day.toISOString().slice(0, 10) : String(row.day),
      orders: toNumber(row.orders),
      sales: toNumber(row.sales),
    }))
  }

  async topProducts({ from, to }: DateRange, limit: number): Promise<ProductSalesRow[]> {
    const rows = await this.prisma.$queryRaw<
      { productId: unknown; title: string; units: unknown; revenue: unknown }[]
    >`
      SELECT (oi."productSnapshot"->>'productId')::int AS "productId",
             MAX(oi."productSnapshot"->>'title') AS title,
             SUM(oi.quantity) AS units,
             SUM(oi."lineTotal" - oi."discountAmount") AS revenue
      FROM order_item oi
      JOIN "order" o ON o.id = oi."orderId"
      WHERE o."paidAt" >= ${from} AND o."paidAt" < ${to} AND o.status <> 'CANCELLED'
      GROUP BY "productId"
      ORDER BY revenue DESC
      LIMIT ${limit}
    `
    return rows.map((row) => ({
      productId: toNumber(row.productId),
      title: row.title,
      units: toNumber(row.units),
      revenue: toNumber(row.revenue),
    }))
  }

  async salesByCategory({ from, to }: DateRange): Promise<CategorySalesRow[]> {
    const rows = await this.prisma.$queryRaw<
      { categoryId: number | null; title: string | null; units: unknown; revenue: unknown }[]
    >`
      SELECT c.id AS "categoryId", c.title AS title,
             SUM(oi.quantity) AS units,
             SUM(oi."lineTotal" - oi."discountAmount") AS revenue
      FROM order_item oi
      JOIN "order" o ON o.id = oi."orderId"
      LEFT JOIN product p ON p.id = (oi."productSnapshot"->>'productId')::int
      LEFT JOIN category c ON c.id = p."categoryId"
      WHERE o."paidAt" >= ${from} AND o."paidAt" < ${to} AND o.status <> 'CANCELLED'
      GROUP BY c.id, c.title
      ORDER BY revenue DESC
    `
    return rows.map((row) => ({
      categoryId: row.categoryId === null ? null : toNumber(row.categoryId),
      title: row.title,
      units: toNumber(row.units),
      revenue: toNumber(row.revenue),
    }))
  }

  async paymentConversion({ from, to }: DateRange): Promise<PaymentConversionView> {
    const where: Prisma.orderWhereInput = {
      paymentMethod: 'ONLINE',
      created_at: { gte: from, lt: to },
    }
    const [placed, paid, cancelled] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.count({ where: { ...where, paidAt: { not: null } } }),
      this.prisma.order.count({ where: { ...where, status: 'CANCELLED', paidAt: null } }),
    ])
    return { placed, paid, cancelled, rate: placed > 0 ? paid / placed : 0 }
  }

  async ordersCsv({ from, to }: DateRange): Promise<string> {
    const orders = await this.prisma.order.findMany({
      where: { created_at: { gte: from, lt: to } },
      include: { user: { select: { phone_number: true } } },
      orderBy: { created_at: 'asc' },
      take: MAX_CSV_ROWS,
    })
    return toCsv(
      [
        'number',
        'created_at',
        'paid_at',
        'status',
        'payment_method',
        'customer_phone',
        'items',
        'subtotal_rial',
        'shipping_rial',
        'discount_rial',
        'vat_rial',
        'total_rial',
        'refunded_rial',
      ],
      orders.map((order) => [
        order.number,
        order.created_at,
        order.paidAt,
        order.status,
        order.paymentMethod,
        order.user.phone_number,
        order.itemCount,
        order.subtotal,
        order.shippingFee,
        order.discountTotal,
        order.taxTotal,
        order.total,
        order.refundedTotal,
      ])
    )
  }

  async productsCsv(): Promise<string> {
    const variants = await this.prisma.product_variant.findMany({
      include: {
        product: { select: { id: true, title: true, publish: true, tax_exempt: true } },
        inventory: true,
        optionValues: { include: { optionValue: { include: { option: true } } } },
      },
      orderBy: [{ productId: 'asc' }, { id: 'asc' }],
      take: MAX_CSV_ROWS,
    })
    return toCsv(
      [
        'product_id',
        'product',
        'sku',
        'options',
        'price_rial',
        'sale_price_rial',
        'on_hand',
        'reserved',
        'variant_active',
        'published',
        'tax_exempt',
      ],
      variants.map((variant) => [
        variant.product.id,
        variant.product.title,
        variant.sku,
        variant.optionValues
          .map((link) => `${link.optionValue.option.name}: ${link.optionValue.value}`)
          .join('؛ '),
        variant.price,
        variant.sale_price,
        variant.inventory.reduce((sum, level) => sum + level.on_hand, 0),
        variant.inventory.reduce((sum, level) => sum + level.reserved, 0),
        variant.is_active,
        variant.product.publish,
        variant.product.tax_exempt,
      ])
    )
  }

  private async salesBetween(range: DateRange): Promise<{ orders: number; sales: number }> {
    const where: Prisma.orderWhereInput = {
      paidAt: { gte: range.from, lt: range.to },
      status: { not: 'CANCELLED' },
    }
    const result = await this.prisma.order.aggregate({
      where,
      _count: { _all: true },
      _sum: { total: true, refundedTotal: true },
    })
    return {
      orders: result._count._all,
      sales: (result._sum.total ?? 0) - (result._sum.refundedTotal ?? 0),
    }
  }

  private async lowStockCount(): Promise<number> {
    const rows = await this.prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) AS count FROM (
        SELECT v.id
        FROM product_variant v
        LEFT JOIN inventory_level l ON l."variantId" = v.id
        WHERE v.low_stock_threshold IS NOT NULL AND v.is_active = true
        GROUP BY v.id, v.low_stock_threshold
        HAVING COALESCE(SUM(l.on_hand - l.reserved), 0) <= v.low_stock_threshold
      ) low
    `
    return toNumber(rows[0]?.count)
  }
}
