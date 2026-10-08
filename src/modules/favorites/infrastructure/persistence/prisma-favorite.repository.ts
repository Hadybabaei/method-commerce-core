import { Inject, Injectable } from '@nestjs/common'
import { EVENT_PUBLISHER, EventPublisher } from '@shared/application/ports/event-publisher.port'
import { PrismaService } from '@shared/infrastructure/persistence/prisma/prisma.service'
import { Favorite } from '../../domain/entities/favorite.aggregate'
import { FavoriteRepository } from '../../domain/repositories/favorite.repository'
import { toDomainFavorite } from './mappers/favorite.mapper'

@Injectable()
export class PrismaFavoriteRepository implements FavoriteRepository {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisher
  ) {}

  async findByUserAndProduct(userId: number, productId: number): Promise<Favorite | null> {
    const record = await this.prisma.user_favorite.findUnique({
      where: { userId_productId: { userId, productId } },
    })

    return record ? toDomainFavorite(record) : null
  }

  async save(favorite: Favorite): Promise<Favorite> {
    if (!favorite.isNew) {
      // Only the chosen variant can change.
      const record = await this.prisma.user_favorite.update({
        where: { userId_productId: { userId: favorite.userId, productId: favorite.productId } },
        data: { variantId: favorite.variantId },
      })
      return toDomainFavorite(record)
    }

    const record = await this.prisma.user_favorite.create({
      data: {
        userId: favorite.userId,
        productId: favorite.productId,
        variantId: favorite.variantId,
      },
    })

    await this.events.publish(favorite.pullDomainEvents())

    return toDomainFavorite(record)
  }

  async delete(favorite: Favorite): Promise<void> {
    await this.prisma.user_favorite.delete({
      where: {
        userId_productId: { userId: favorite.userId, productId: favorite.productId },
      },
    })

    await this.events.publish(favorite.pullDomainEvents())
  }
}
