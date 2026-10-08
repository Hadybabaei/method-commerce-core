import { ProductSummaryView, ProductVariantView } from '@modules/catalog/application/dto/views'

export interface FavoriteView {
  id: number
  favoritedAt: Date
  product: ProductSummaryView
  /** The variant the customer saved, with its current price and stock; null = the product in general. */
  variant: ProductVariantView | null
}

export interface AddFavoriteCommand {
  userId: number
  productId: number
  variantId?: number | null
}

export interface ChooseFavoriteVariantCommand {
  userId: number
  productId: number
  variantId: number | null
}

export interface RemoveFavoriteCommand {
  userId: number
  productId: number
}
