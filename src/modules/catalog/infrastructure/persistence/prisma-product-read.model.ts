import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '@shared/infrastructure/persistence/prisma/prisma.service'
import { ProductListCriteria, ProductReadModel } from '../../application/ports/product-read.port'
import { PaginatedView, ProductDetailView, ProductSummaryView } from '../../application/dto/views'
import {
  productDetailInclude,
  productSummaryInclude,
  toProductDetailView,
  toProductSummaryView,
} from './mappers/product-view.mapper'

const SIMPLE_SORT: Record<'newest' | 'oldest' | 'title', Prisma.productOrderByWithRelationInput> = {
  newest: { created_at: 'desc' },
  oldest: { created_at: 'asc' },
  title: { title: 'asc' },
}

/** Cheapest active-variant price used for filters and price sorts. */
const PRICE_FROM = Prisma.sql`MIN(COALESCE(v.sale_price, v.price))`

/** Units still sellable across every active variant. */
const AVAILABLE_QTY = Prisma.sql`COALESCE(SUM(GREATEST(il.on_hand - il.reserved, 0)), 0)`

@Injectable()
export class PrismaProductReadModel implements ProductReadModel {
  constructor(private readonly prisma: PrismaService) {}

  async list(criteria: ProductListCriteria): Promise<PaginatedView<ProductSummaryView>> {
    // Price and stock live on variants / inventory rows, so those filters and
    // sorts need a grouped query. Everything else stays on a plain Prisma find.
    if (PrismaProductReadModel.needsVariantMetrics(criteria)) {
      return this.listWithVariantMetrics(criteria)
    }

    return this.listSimple(criteria)
  }

  async findDetailById(id: number): Promise<ProductDetailView | null> {
    const record = await this.prisma.product.findUnique({
      where: { id },
      include: productDetailInclude,
    })

    return record ? toProductDetailView(record) : null
  }

  async findDetailBySlug(slug: string, publishedOnly: boolean): Promise<ProductDetailView | null> {
    const record = await this.prisma.product.findFirst({
      where: { slug, ...(publishedOnly ? { publish: true } : {}) },
      include: productDetailInclude,
    })

    return record ? toProductDetailView(record) : null
  }

  private async listSimple(
    criteria: ProductListCriteria
  ): Promise<PaginatedView<ProductSummaryView>> {
    const where = PrismaProductReadModel.toWhere(criteria)
    const sort = criteria.sort as 'newest' | 'oldest' | 'title'

    const [total, records] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        include: productSummaryInclude,
        orderBy: [SIMPLE_SORT[sort], { id: 'desc' }],
        take: criteria.limit,
        skip: criteria.offset,
      }),
    ])

    return {
      items: records.map(toProductSummaryView),
      total,
      limit: criteria.limit,
      offset: criteria.offset,
    }
  }

  /**
   * Groups active variants so we can filter/sort on the cheapest effective
   * price (`sale_price ?? price`) and on available stock.
   */
  private async listWithVariantMetrics(
    criteria: ProductListCriteria
  ): Promise<PaginatedView<ProductSummaryView>> {
    const whereSql = PrismaProductReadModel.buildWhereSql(criteria)
    const havingSql = PrismaProductReadModel.buildHavingSql(criteria)
    const orderBy = PrismaProductReadModel.variantMetricsOrderBy(criteria)

    const grouped = Prisma.sql`
      FROM product p
      INNER JOIN product_variant v
        ON v.productId = p.id AND v.is_active = 1
      LEFT JOIN inventory_level il
        ON il.variantId = v.id
      WHERE ${whereSql}
      GROUP BY p.id
      HAVING ${havingSql}
    `

    const [countRows, idRows] = await this.prisma.$transaction([
      this.prisma.$queryRaw<Array<{ total: bigint }>>`
        SELECT COUNT(*) AS total FROM (
          SELECT p.id
          ${grouped}
        ) AS filtered
      `,
      this.prisma.$queryRaw<Array<{ id: number }>>`
        SELECT
          p.id AS id,
          ${PRICE_FROM} AS price_from
        ${grouped}
        ORDER BY ${orderBy}
        LIMIT ${criteria.limit} OFFSET ${criteria.offset}
      `,
    ])

    const total = Number(countRows[0]?.total ?? 0)
    const ids = idRows.map((row) => row.id)

    if (ids.length === 0) {
      return { items: [], total, limit: criteria.limit, offset: criteria.offset }
    }

    const records = await this.prisma.product.findMany({
      where: { id: { in: ids } },
      include: productSummaryInclude,
    })

    const byId = new Map(records.map((record) => [record.id, record]))
    const items = ids
      .map((id) => byId.get(id))
      .filter((record): record is NonNullable<typeof record> => record !== undefined)
      .map(toProductSummaryView)

    return { items, total, limit: criteria.limit, offset: criteria.offset }
  }

  private static needsVariantMetrics(criteria: ProductListCriteria): boolean {
    return (
      criteria.priceMin !== undefined ||
      criteria.priceMax !== undefined ||
      criteria.quantityMin !== undefined ||
      criteria.sort === 'price_asc' ||
      criteria.sort === 'price_desc'
    )
  }

  private static buildWhereSql(criteria: ProductListCriteria): Prisma.Sql {
    const parts: Prisma.Sql[] = [Prisma.sql`1 = 1`]

    if (criteria.publishedOnly) {
      parts.push(Prisma.sql`p.publish = 1`)
    }
    if (criteria.productId !== undefined) {
      parts.push(Prisma.sql`p.id = ${criteria.productId}`)
    }
    if (criteria.categoryIds && criteria.categoryIds.length > 0) {
      parts.push(Prisma.sql`p.categoryId IN (${Prisma.join(criteria.categoryIds)})`)
    }
    if (criteria.brandId !== undefined) {
      parts.push(Prisma.sql`p.brandId = ${criteria.brandId}`)
    }
    if (criteria.title) {
      parts.push(Prisma.sql`p.title LIKE ${`%${criteria.title}%`}`)
    }
    if (criteria.search) {
      const pattern = `%${criteria.search}%`
      parts.push(Prisma.sql`(p.title LIKE ${pattern} OR p.sub_title LIKE ${pattern})`)
    }

    return Prisma.join(parts, ' AND ')
  }

  private static buildHavingSql(criteria: ProductListCriteria): Prisma.Sql {
    const parts: Prisma.Sql[] = [Prisma.sql`1 = 1`]

    if (criteria.priceMin !== undefined) {
      parts.push(Prisma.sql`${PRICE_FROM} >= ${criteria.priceMin}`)
    }
    if (criteria.priceMax !== undefined) {
      parts.push(Prisma.sql`${PRICE_FROM} <= ${criteria.priceMax}`)
    }
    if (criteria.quantityMin !== undefined) {
      parts.push(Prisma.sql`${AVAILABLE_QTY} >= ${criteria.quantityMin}`)
    }

    return Prisma.join(parts, ' AND ')
  }

  private static variantMetricsOrderBy(criteria: ProductListCriteria): Prisma.Sql {
    switch (criteria.sort) {
      case 'price_asc':
        return Prisma.sql`price_from ASC, p.id DESC`
      case 'price_desc':
        return Prisma.sql`price_from DESC, p.id DESC`
      case 'oldest':
        return Prisma.sql`p.created_at ASC, p.id DESC`
      case 'title':
        return Prisma.sql`p.title ASC, p.id DESC`
      case 'newest':
      default:
        return Prisma.sql`p.created_at DESC, p.id DESC`
    }
  }

  private static toWhere(criteria: ProductListCriteria): Prisma.productWhereInput {
    const where: Prisma.productWhereInput = {}

    if (criteria.publishedOnly) {
      where.publish = true
    }

    if (criteria.productId !== undefined) {
      where.id = criteria.productId
    }

    if (criteria.categoryIds && criteria.categoryIds.length > 0) {
      where.categoryId = { in: criteria.categoryIds }
    }

    if (criteria.brandId !== undefined) {
      where.brandId = criteria.brandId
    }

    if (criteria.title) {
      where.title = { contains: criteria.title }
    }

    if (criteria.search) {
      where.OR = [
        { title: { contains: criteria.search } },
        { sub_title: { contains: criteria.search } },
      ]
    }

    return where
  }
}
