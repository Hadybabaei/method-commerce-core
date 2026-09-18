export interface CreateCategoryCommand {
  title: string
  slug?: string
  icon?: string | null
  description?: string | null
  parentId?: number | null
  position?: number
}

export interface UpdateCategoryCommand {
  categoryId: number
  title?: string
  slug?: string
  icon?: string | null
  description?: string | null
  /** Present in the payload only when the category is being re-parented. */
  parentId?: number | null
  position?: number
}

export interface CreateBrandCommand {
  title: string
  slug?: string
  logo?: string | null
  description?: string | null
}

export interface UpdateBrandCommand {
  brandId: number
  title?: string
  slug?: string
  logo?: string | null
  description?: string | null
}

export interface ProductImageCommand {
  url: string
  thumbnail?: boolean
}

export interface CreateProductCommand {
  title: string
  slug?: string
  subTitle?: string | null
  description?: string | null
  shortDescription?: string | null
  published?: boolean
  weightGrams?: number
  categoryId?: number | null
  brandId?: number | null
  images?: ProductImageCommand[]
}

export interface UpdateProductCommand {
  productId: number
  title?: string
  slug?: string
  subTitle?: string | null
  description?: string | null
  shortDescription?: string | null
  published?: boolean
  weightGrams?: number
  categoryId?: number | null
  brandId?: number | null
  /** When present, replaces the whole image list. */
  images?: ProductImageCommand[]
}

export interface ProductOptionCommand {
  name: string
  values: string[]
}

export interface ReplaceProductOptionsCommand {
  productId: number
  options: ProductOptionCommand[]
}

export interface VariantOptionCommand {
  option: string
  value: string
}

export interface AddProductVariantCommand {
  productId: number
  sku: string
  price: number
  salePrice?: number | null
  weightGrams?: number | null
  image?: string | null
  isActive?: boolean
  options?: VariantOptionCommand[]
  onHand?: number
}

export interface UpdateProductVariantCommand {
  productId: number
  variantId: number
  sku?: string
  price?: number
  salePrice?: number | null
  weightGrams?: number | null
  image?: string | null
  isActive?: boolean
  onHand?: number
}

export interface DeleteProductVariantCommand {
  productId: number
  variantId: number
}

export type ProductSort = 'newest' | 'oldest' | 'title' | 'price_asc' | 'price_desc'

export interface ListProductsQuery {
  /** Exact product id. */
  productId?: number
  /** Matches the category and everything beneath it. */
  categoryId?: number
  categorySlug?: string
  brandId?: number
  brandSlug?: string
  /** Case-insensitive match on the product title only. */
  title?: string
  /** Broader text match on title and sub-title. */
  search?: string
  /** Inclusive floor for the product's cheapest active variant, in Rial. */
  priceMin?: number
  /** Inclusive ceiling for the product's cheapest active variant, in Rial. */
  priceMax?: number
  /**
   * Minimum available stock across all active variants
   * (`sum(max(0, on_hand - reserved))`). Use 1 for "in stock".
   */
  quantityMin?: number
  sort?: ProductSort
  limit?: number
  offset?: number
  /** Admin listings pass false to see drafts as well. */
  publishedOnly?: boolean
}
