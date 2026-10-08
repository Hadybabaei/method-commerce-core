import { Injectable } from '@nestjs/common'
import { PrismaService } from '@shared/infrastructure/persistence/prisma/prisma.service'
import { CatalogLookup } from '../application/search.use-cases'

@Injectable()
export class PrismaCatalogLookup implements CatalogLookup {
  constructor(private readonly prisma: PrismaService) {}

  async categoryIdBySlug(slug: string): Promise<number | null> {
    const category = await this.prisma.category.findUnique({
      where: { slug },
      select: { id: true },
    })
    return category?.id ?? null
  }

  async brandIdsBySlugs(slugs: string[]): Promise<number[]> {
    const brands = await this.prisma.brand.findMany({
      where: { slug: { in: slugs } },
      select: { id: true },
    })
    return brands.map((brand) => brand.id)
  }

  async productBySlug(slug: string) {
    return this.prisma.product.findFirst({
      where: { slug, publish: true },
      select: { id: true, categoryId: true, brandId: true },
    })
  }
}
