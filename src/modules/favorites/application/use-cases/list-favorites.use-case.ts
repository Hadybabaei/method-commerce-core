import { Inject, Injectable } from '@nestjs/common'
import { UseCase } from '@shared/application/use-case'
import { FavoriteView } from '../dto/views'
import { FAVORITE_READ_MODEL, FavoriteReadModel } from '../ports/favorite-read.port'

@Injectable()
export class ListFavoritesUseCase implements UseCase<number, FavoriteView[]> {
  constructor(@Inject(FAVORITE_READ_MODEL) private readonly favoriteReads: FavoriteReadModel) {}

  execute(userId: number): Promise<FavoriteView[]> {
    return this.favoriteReads.listByUserId(userId)
  }
}
