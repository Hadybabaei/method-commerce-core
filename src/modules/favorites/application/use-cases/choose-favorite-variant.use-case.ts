import { Inject, Injectable } from '@nestjs/common'
import { VariantNotFoundError } from '@modules/catalog/domain/errors/catalog.errors'
import {
  PRODUCT_REPOSITORY,
  ProductRepository,
} from '@modules/catalog/domain/repositories/product.repository'
import { UseCase } from '@shared/application/use-case'
import { FAVORITE_READ_MODEL, FavoriteReadModel } from '../ports/favorite-read.port'
import { ChooseFavoriteVariantCommand, FavoriteView } from '../dto/views'
import { FavoriteNotFoundError } from '../../domain/errors/favorites.errors'
import {
  FAVORITE_REPOSITORY,
  FavoriteRepository,
} from '../../domain/repositories/favorite.repository'

/** Changes which size, colour, etc. a saved product is kept in. */
@Injectable()
export class ChooseFavoriteVariantUseCase implements UseCase<
  ChooseFavoriteVariantCommand,
  FavoriteView
> {
  constructor(
    @Inject(FAVORITE_REPOSITORY) private readonly favorites: FavoriteRepository,
    @Inject(FAVORITE_READ_MODEL) private readonly favoriteReads: FavoriteReadModel,
    @Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepository
  ) {}

  async execute(command: ChooseFavoriteVariantCommand): Promise<FavoriteView> {
    const favorite = await this.favorites.findByUserAndProduct(command.userId, command.productId)
    if (!favorite) throw new FavoriteNotFoundError(command.productId)

    if (command.variantId !== null) {
      const product = await this.products.findById(command.productId)
      if (!product?.findVariantById(command.variantId)) {
        throw new VariantNotFoundError(command.variantId)
      }
    }

    favorite.chooseVariant(command.variantId)
    await this.favorites.save(favorite)

    const view = await this.favoriteReads.findByUserAndProduct(command.userId, command.productId)
    if (!view) throw new FavoriteNotFoundError(command.productId)
    return view
  }
}
