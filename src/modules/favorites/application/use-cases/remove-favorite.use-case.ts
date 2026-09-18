import { Inject, Injectable } from '@nestjs/common'
import { UseCase } from '@shared/application/use-case'
import { FavoriteNotFoundError } from '../../domain/errors/favorites.errors'
import {
  FAVORITE_REPOSITORY,
  FavoriteRepository,
} from '../../domain/repositories/favorite.repository'
import { RemoveFavoriteCommand } from '../dto/views'

@Injectable()
export class RemoveFavoriteUseCase implements UseCase<RemoveFavoriteCommand, void> {
  constructor(@Inject(FAVORITE_REPOSITORY) private readonly favorites: FavoriteRepository) {}

  async execute(command: RemoveFavoriteCommand): Promise<void> {
    const favorite = await this.favorites.findByUserAndProduct(command.userId, command.productId)
    if (!favorite) {
      throw new FavoriteNotFoundError(command.productId)
    }

    favorite.ensureOwnedBy(command.userId)
    favorite.markRemoved()
    await this.favorites.delete(favorite)
  }
}
