import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '@shared/infrastructure/persistence/prisma/prisma.service'
import {
  BoughtTogetherReadModel,
  ProductDocument,
  ProductDocumentSource,
} from '../application/search.ports'

const include = {
  category: { select: { id: true, title: true, slug: true, path: true } },
  brand: { select: { id: true, title: true, slug: true } },
  images: { orderBy: { position: 'asc' }, select: { url: true, thumbnail: true } },
  variants: {
    where: { is_active: true },
    select: {
      price: true,
      sale_price: true,
      inventory: { select: { on_hand: true, reserved: true } },
      optionValues: {
        select: { optionValue: { select: { value: true, option: { select: { name: true } } } } },
      },
    },
  },
} satisfies Prisma.productInclude

type Record = Prisma.productGetPayload<{ include: typeof include }>

const num = (value: unknown) => (value === null || value === undefined ? 0 : Number(value))

/** "/1/7/12/" → [1, 7, 12]. */
export function pathIds(path: string | null | undefined): number[] {
  return (path ?? '').split('/').filter(Boolean).map(Number).filter(Number.isInteger)
}

export function toDocument(
  record: Record,
  rating: { average: number; count: number } | undefined,
  sales: number
): ProductDocument {
  const prices = record.variants.map((variant) => variant.sale_price ?? variant.price)
  const options = new Set<string>()
  for (const variant of record.variants) {
    for (const { optionValue } of variant.optionValues)
      options.add(`${optionValue.option.name}:${optionValue.value}`)
  }
  const category = record.category
  const ancestors = pathIds(category?.path)
  return {
    id: record.id,
    title: record.title,
    subTitle: record.sub_title,
    slug: record.slug,
    thumbnail: record.images.find((image) => image.thumbnail)?.url ?? record.images[0]?.url ?? null,
    category: category ? { id: category.id, title: category.title, slug: category.slug } : null,
    categoryIds: category ? [...new Set([...ancestors, category.id])] : [],
    brand: record.brand,
    options: [...options].sort(),
    priceFrom: prices.length ? Math.min(...prices) : null,
    priceTo: prices.length ? Math.max(...prices) : null,
    inStock: record.variants.some((variant) =>
      variant.inventory.some((level) => level.on_hand - level.reserved > 0)
    ),
    ratingAverage: rating ? Math.round(rating.average * 10) / 10 : 0,
    ratingCount: rating?.count ?? 0,
    salesCount: sales,
    createdAt: record.created_at.getTime(),
  }
}

@Injectable()
export class PrismaProductDocumentSource implements ProductDocumentSource, BoughtTogetherReadModel {
  constructor(private readonly prisma: PrismaService) {}

  async byIds(ids: number[]): Promise<ProductDocument[]> {
    if (ids.length === 0) return []
    return this.load({ id: { in: ids }, publish: true })
  }

  async all(): Promise<ProductDocument[]> {
    return this.load({ publish: true })
  }

  async productIdsForVariants(variantIds: number[]): Promise<number[]> {
    if (variantIds.length === 0) return []
    const rows = await this.prisma.product_variant.findMany({
      where: { id: { in: variantIds } },
      select: { productId: true },
    })
    return [...new Set(rows.map((row) => row.productId))]
  }

  async productIds(productId: number, limit: number): Promise<number[]> {
    const rows = await this.prisma.$queryRaw<{ productId: unknown }[]>`
      SELECT (other."productSnapshot"->>'productId')::int AS "productId",
             COUNT(DISTINCT other."orderId") AS orders
      FROM order_item mine
      JOIN "order" o ON o.id = mine."orderId" AND o."paidAt" IS NOT NULL AND o.status <> 'CANCELLED'
      JOIN order_item other ON other."orderId" = mine."orderId"
      WHERE (mine."productSnapshot"->>'productId')::int = ${productId}
        AND (other."productSnapshot"->>'productId')::int <> ${productId}
      GROUP BY "productId"
      ORDER BY orders DESC, "productId" DESC
      LIMIT ${limit}
    `
    return rows.map((row) => num(row.productId))
  }

  private async load(where: Prisma.productWhereInput): Promise<ProductDocument[]> {
    const records = await this.prisma.product.findMany({ where, include, orderBy: { id: 'asc' } })
    if (records.length === 0) return []
    const ids = records.map((record) => record.id)
    const [ratings, sales] = await Promise.all([this.ratings(ids), this.sales(ids)])
    return records.map((record) =>
      toDocument(record, ratings.get(record.id), sales.get(record.id) ?? 0)
    )
  }

  private async ratings(ids: number[]): Promise<Map<number, { average: number; count: number }>> {
    const rows = await this.prisma.comment.groupBy({
      by: ['productId'],
      where: { productId: { in: ids }, published: true, parentId: null, rate: { not: null } },
      _avg: { rate: true },
      _count: { rate: true },
    })
    return new Map(
      rows.map((row) => [row.productId, { average: num(row._avg.rate), count: row._count.rate }])
    )
  }

  private async sales(ids: number[]): Promise<Map<number, number>> {
    const rows = await this.prisma.$queryRaw<{ productId: unknown; units: unknown }[]>`
      SELECT (oi."productSnapshot"->>'productId')::int AS "productId",
             SUM(oi.quantity) AS units
      FROM order_item oi
      JOIN "order" o ON o.id = oi."orderId"
      WHERE o."paidAt" IS NOT NULL AND o.status <> 'CANCELLED'
        AND (oi."productSnapshot"->>'productId')::int IN (${Prisma.join(ids)})
      GROUP BY "productId"
    `
    return new Map(rows.map((row) => [num(row.productId), num(row.units)]))
  }
}
