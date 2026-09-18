import { ProductSummaryView } from '@modules/catalog/application/dto/views'

export interface FavoriteView {
  id: number
  favoritedAt: Date
  product: ProductSummaryView
}

export interface AddFavoriteCommand {
  userId: number
  productId: number
}

export interface RemoveFavoriteCommand {
  userId: number
  productId: number
}
