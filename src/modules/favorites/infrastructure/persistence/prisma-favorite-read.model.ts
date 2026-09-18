import { Injectable } from '@nestjs/common'
import { PrismaService } from '@shared/infrastructure/persistence/prisma/prisma.service'
import {
  productSummaryInclude,
  toProductSummaryView,
} from '@modules/catalog/infrastructure/persistence/mappers/product-view.mapper'
import { FavoriteView } from '../../application/dto/views'
import { FavoriteReadModel } from '../../application/ports/favorite-read.port'

@Injectable()
export class PrismaFavoriteReadModel implements FavoriteReadModel {
  constructor(private readonly prisma: PrismaService) {}

  async listByUserId(userId: number): Promise<FavoriteView[]> {
    const records = await this.prisma.user_favorite.findMany({
      where: {
        userId,
        // Drafts and deleted products must not surface on the storefront list.
        product: { publish: true },
      },
      orderBy: { created_at: 'desc' },
      include: { product: { include: productSummaryInclude } },
    })

    return records.map((record) => ({
      id: record.id,
      favoritedAt: record.created_at,
      product: toProductSummaryView(record.product),
    }))
  }

  async findByUserAndProduct(userId: number, productId: number): Promise<FavoriteView | null> {
    const record = await this.prisma.user_favorite.findUnique({
      where: { userId_productId: { userId, productId } },
      include: { product: { include: productSummaryInclude } },
    })

    if (!record || !record.product.publish) {
      return null
    }

    return {
      id: record.id,
      favoritedAt: record.created_at,
      product: toProductSummaryView(record.product),
    }
  }
}
