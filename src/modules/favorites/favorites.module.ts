import { Module } from '@nestjs/common'
import { CatalogModule } from '@modules/catalog/catalog.module'
import { IdentityModule } from '@modules/identity/identity.module'
import { FAVORITE_READ_MODEL } from './application/ports/favorite-read.port'
import { AddFavoriteUseCase } from './application/use-cases/add-favorite.use-case'
import { ListFavoritesUseCase } from './application/use-cases/list-favorites.use-case'
import { RemoveFavoriteUseCase } from './application/use-cases/remove-favorite.use-case'
import { FAVORITE_REPOSITORY } from './domain/repositories/favorite.repository'
import { PrismaFavoriteReadModel } from './infrastructure/persistence/prisma-favorite-read.model'
import { PrismaFavoriteRepository } from './infrastructure/persistence/prisma-favorite.repository'
import { FavoritesController } from './presentation/controllers/favorites.controller'

/**
 * Favorites bounded context: a customer's wishlist of catalog products.
 * Imports Identity for the customer guard and Catalog to verify the product.
 */
@Module({
  imports: [IdentityModule, CatalogModule],
  controllers: [FavoritesController],
  providers: [
    { provide: FAVORITE_REPOSITORY, useClass: PrismaFavoriteRepository },
    { provide: FAVORITE_READ_MODEL, useClass: PrismaFavoriteReadModel },
    AddFavoriteUseCase,
    RemoveFavoriteUseCase,
    ListFavoritesUseCase,
  ],
})
export class FavoritesModule {}
