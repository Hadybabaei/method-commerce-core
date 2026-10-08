import { Injectable } from '@nestjs/common'
import { SlugRedirectType } from '@prisma/client'
import { PrismaService } from '@shared/infrastructure/persistence/prisma/prisma.service'
import {
  CatalogEntryType,
  CatalogSeoReadModel,
  SitemapView,
} from '../../application/ports/catalog-seo-read.port'

const REDIRECT_TYPE: Record<CatalogEntryType, SlugRedirectType> = {
  product: SlugRedirectType.PRODUCT,
  category: SlugRedirectType.CATEGORY,
  brand: SlugRedirectType.BRAND,
}

/** Google's limit for one sitemap file. */
const MAX_SITEMAP_PRODUCTS = 50_000

@Injectable()
export class PrismaCatalogSeoReadModel implements CatalogSeoReadModel {
  constructor(private readonly prisma: PrismaService) {}

  async resolveRedirect(type: CatalogEntryType, slug: string): Promise<string | null> {
    const redirect = await this.prisma.slug_redirect.findUnique({
      where: { type_old_slug: { type: REDIRECT_TYPE[type], old_slug: slug } },
      select: { targetId: true },
    })
    if (!redirect) {
      return null
    }

    const where = { id: redirect.targetId }
    const target =
      type === 'product'
        ? await this.prisma.product.findFirst({
            where: { ...where, publish: true },
            select: { slug: true },
          })
        : type === 'category'
          ? await this.prisma.category.findUnique({ where, select: { slug: true } })
          : await this.prisma.brand.findUnique({ where, select: { slug: true } })

    return target && target.slug !== slug ? target.slug : null
  }

  async sitemap(): Promise<SitemapView> {
    const select = { slug: true, updated_at: true } as const
    const [products, categories, brands] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where: { publish: true },
        select,
        orderBy: { updated_at: 'desc' },
        take: MAX_SITEMAP_PRODUCTS,
      }),
      this.prisma.category.findMany({ select, orderBy: [{ depth: 'asc' }, { position: 'asc' }] }),
      this.prisma.brand.findMany({ select, orderBy: { title: 'asc' } }),
    ])

    const toEntry = (record: { slug: string; updated_at: Date }) => ({
      slug: record.slug,
      updatedAt: record.updated_at,
    })
    return {
      products: products.map(toEntry),
      categories: categories.map(toEntry),
      brands: brands.map(toEntry),
    }
  }
}
