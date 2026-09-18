import { Inject, Injectable } from '@nestjs/common'
import {
  PRODUCT_REPOSITORY,
  ProductRepository,
} from '@modules/catalog/domain/repositories/product.repository'
import { ProductNotFoundError } from '@modules/catalog/domain/errors/catalog.errors'
import { UseCase } from '@shared/application/use-case'
import { Favorite } from '../../domain/entities/favorite.aggregate'
import {
  FavoriteAlreadyExistsError,
  FavoriteNotFoundError,
} from '../../domain/errors/favorites.errors'
import {
  FAVORITE_REPOSITORY,
  FavoriteRepository,
} from '../../domain/repositories/favorite.repository'
import { AddFavoriteCommand, FavoriteView } from '../dto/views'
import { FAVORITE_READ_MODEL, FavoriteReadModel } from '../ports/favorite-read.port'

@Injectable()
export class AddFavoriteUseCase implements UseCase<AddFavoriteCommand, FavoriteView> {
  constructor(
    @Inject(FAVORITE_REPOSITORY) private readonly favorites: FavoriteRepository,
    @Inject(FAVORITE_READ_MODEL) private readonly favoriteReads: FavoriteReadModel,
    @Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepository
  ) {}

  async execute(command: AddFavoriteCommand): Promise<FavoriteView> {
    const product = await this.products.findById(command.productId)

    // Unpublished products look missing on the storefront; keep that here too.
    if (!product || !product.published) {
      throw new ProductNotFoundError(command.productId)
    }

    const existing = await this.favorites.findByUserAndProduct(command.userId, command.productId)
    if (existing) {
      throw new FavoriteAlreadyExistsError(command.productId)
    }

    const saved = await this.favorites.save(
      Favorite.create({ userId: command.userId, productId: command.productId })
    )

    const view = await this.favoriteReads.findByUserAndProduct(command.userId, saved.productId)
    if (!view) {
      throw new FavoriteNotFoundError(saved.productId)
    }

    return view
  }
}
